import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function logWorkout(page: Page) {
  await page.getByRole('button', { name: 'Start Ben' }).click();
  const ex = page.getByRole('article', { name: 'Squat', exact: true });
  for (const n of [1, 2]) {
    await ex.getByLabel(`Vægt sæt ${n}`).fill('60');
    await ex.getByLabel(`Reps sæt ${n}`).fill('8');
    await ex.getByRole('button', { name: `Udført sæt ${n}` }).click();
  }
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

const thisYear = new Date().getFullYear();

test('"Året" i Profil viser dagens træning og årets tal (#265)', async ({ page }) => {
  await page.getByRole('button', { name: 'Profil' }).click();
  await expect(page.getByRole('region', { name: 'Året' })).toHaveCount(0); // ingen historik endnu
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();

  await logWorkout(page);
  await page.getByRole('button', { name: 'Profil' }).click();
  const card = page.getByRole('region', { name: 'Året' });
  await expect(card.getByRole('heading', { name: `Året ${thisYear}` })).toBeVisible();
  await expect(card.getByText('1 træningsdag', { exact: true })).toBeVisible();
  await expect(card.getByText('Længste stime: 1 uge')).toBeVisible();
  await expect(card.getByText(/^Travleste måned: \p{Ll}+$/u)).toBeVisible();
  const today = card.getByRole('button', { name: /: 2 sæt \(i dag\)$/ });
  await expect(today).toHaveAttribute('data-level', '4');
  await expect(card.getByRole('img', { name: /ingen træning/ }).first()).toHaveAttribute('data-level', '0');

  await page.setViewportSize({ width: 360, height: 800 });
  await card.scrollIntoViewIfNeeded();
  await expect(today).toBeInViewport(); // gitteret er rullet hen til i dag
  await card.screenshot({ path: 'test-results/year-heatmap.png' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('"Året" skifter til sidste år og tilbage med pilene (#265)', async ({ page }) => {
  await logWorkout(page);
  // Kopiér træningen til samme dag sidste år
  await page.evaluate(() => {
    const key = 'loeft-state-v1';
    const s = JSON.parse(localStorage.getItem(key)!);
    const w = s.history[0];
    const shift = (t: number) => { const d = new Date(t); d.setFullYear(d.getFullYear() - 1); return d.getTime(); };
    s.history.push({ ...w, id: 'last-year', startedAt: shift(w.startedAt), finishedAt: w.finishedAt && shift(w.finishedAt) });
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Profil' }).click();
  const card = page.getByRole('region', { name: 'Året' });
  await expect(card.getByRole('button', { name: 'Næste år' })).toBeDisabled();

  await card.getByRole('button', { name: 'Forrige år' }).click();
  await expect(card.getByRole('heading', { name: `Året ${thisYear - 1}` })).toBeVisible();
  await expect(card.getByText('1 træningsdag', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: /\(i dag\)/ })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Forrige år' })).toBeDisabled();

  await card.getByRole('button', { name: 'Næste år' }).click();
  await expect(card.getByRole('heading', { name: `Året ${thisYear}` })).toBeVisible();
});

test('tryk på dagens felt i "Året" åbner træningen (#266)', async ({ page }) => {
  await logWorkout(page);
  await page.getByRole('button', { name: 'Profil' }).click();
  const card = page.getByRole('region', { name: 'Året' });
  await card.getByRole('button', { name: /\(i dag\)$/ }).click();
  const detail = page.getByRole('dialog', { name: 'Ben' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('Squat')).toBeVisible();
  await detail.getByRole('button', { name: 'Luk' }).click();
  await expect(detail).toHaveCount(0);
});

test('to træninger samme dag: tryk viser begge, og den valgte åbnes (#266)', async ({ page }) => {
  await logWorkout(page);
  await page.evaluate(() => {
    const key = 'loeft-state-v1';
    const s = JSON.parse(localStorage.getItem(key)!);
    const w = s.history[0];
    s.history.unshift({ ...w, id: 'evening', name: 'Aftentræning', startedAt: w.startedAt + 1, finishedAt: (w.finishedAt ?? w.startedAt) + 1 });
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Profil' }).click();
  const card = page.getByRole('region', { name: 'Året' });
  await card.getByRole('button', { name: /\(i dag\)$/ }).click();
  const list = page.getByRole('dialog');
  await expect(list.getByRole('button', { name: /^Træning / })).toHaveCount(2);
  await expect(list.getByRole('button', { name: 'Træning Ben' })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/year-heatmap-pick.png' });
  await list.getByRole('button', { name: 'Træning Aftentræning' }).click();
  await expect(page.getByRole('dialog', { name: 'Aftentræning' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
});
