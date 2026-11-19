import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function benchSet(page: Page, n: number, weight: string) {
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel(`Vægt sæt ${n}`).fill(weight);
  await bench.getByLabel(`Reps sæt ${n}`).fill('5');
  await bench.getByRole('button', { name: `Udført sæt ${n}` }).click();
}

test('"vs. sidst" viser forskellen mod sidste Push og ▲ når bænkpres er færdig (#176)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  for (const n of [1, 2, 3]) await benchSet(page, n, '80');
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  const bar = workout.getByTestId('vs-bar');
  await expect(bar).toHaveCount(0); // skjult indtil første arbejdssæt er krydset af

  await benchSet(page, 1, '85');
  await expect(bar).toHaveText('+25 kg vs. sidst');
  const bench = workout.getByRole('article', { name: 'Bænkpres', exact: true });
  await expect(bench.getByRole('img', { name: 'Slog sidst' })).toHaveCount(0);

  await benchSet(page, 2, '80');
  await benchSet(page, 3, '80');
  await expect(bar).toHaveText('+25 kg vs. sidst');
  await expect(bench.getByRole('img', { name: 'Slog sidst' })).toBeVisible();
  await page.screenshot({ path: 'test-results/vs-last-time.png' });

  // Fjern fluebenet igen → opdateres med det samme
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(bar).toHaveText('Som sidst');
  await expect(bench.getByRole('img', { name: 'Slog sidst' })).toHaveCount(0);
});

test('en tom træning (uden skabelon) viser ingen "vs. sidst" (#176)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  await benchSet(page, 1, '80');
  await expect(workout.getByTestId('vs-bar')).toHaveCount(0);
});
