import { expect, test, type Page } from '@playwright/test';

async function logBench(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).first().click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const card = workout.getByRole('article', { name: 'Bænkpres', exact: true });
  await card.getByLabel('Vægt sæt 1').fill('80');
  await card.getByLabel('Reps sæt 1').fill('8');
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

test('ny bruger ser "Træn lidt mere" i Balance (#368)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const card = page.getByRole('region', { name: 'Balance' });
  await expect(card).toContainText('Træn lidt mere, så viser vi din balance her');
});

test('kun bænkpres → Pres 100 % og et tip om træk, der åbner øvelsen (#368)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await logBench(page);
  // Gør den ene træning til 12 udførte bænkpres-sæt
  await page.evaluate(() => {
    const key = 'loeft-state-v1';
    const s = JSON.parse(localStorage.getItem(key)!);
    const ex = s.history[0].exercises[0];
    ex.sets = Array.from({ length: 12 }, (_, i) => ({ ...ex.sets[0], id: `s${i}` }));
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const card = page.getByRole('region', { name: 'Balance' });
  await expect(card.getByRole('img', { name: 'Pres 12 sæt, træk 0 sæt' })).toBeVisible();
  await expect(card.getByRole('img', { name: 'Overkrop 12 sæt, underkrop 0 sæt' })).toBeVisible();
  await expect(card).toContainText('Pres 100 %');
  await expect(card).toContainText('Du træner pres, men ingen træk – prøv at tilføje');

  await page.setViewportSize({ width: 360, height: 800 });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/balance.png' });

  await card.getByRole('button', { name: 'Åbn Roning' }).click();
  await expect(page.getByRole('dialog', { name: 'Roning' })).toBeVisible();
});
