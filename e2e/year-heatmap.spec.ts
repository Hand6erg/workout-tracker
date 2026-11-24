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
  const today = card.getByRole('listitem', { name: /: 2 sæt \(i dag\)$/ });
  await expect(today).toHaveAttribute('data-level', '4');
  await expect(card.getByRole('listitem', { name: /ingen træning/ }).first()).toHaveAttribute('data-level', '0');

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
  await expect(card.getByRole('listitem', { name: /\(i dag\)/ })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Forrige år' })).toBeDisabled();

  await card.getByRole('button', { name: 'Næste år' }).click();
  await expect(card.getByRole('heading', { name: `Året ${thisYear}` })).toBeVisible();
});
