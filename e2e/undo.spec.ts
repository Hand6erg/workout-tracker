import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function startWithBench(page: Page) {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  return workout;
}

test('fortryder et slettet sæt med samme vægt, reps og ✓ (#222)', async ({ page }) => {
  const workout = await startWithBench(page);
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();

  await bench.getByRole('button', { name: 'Slet sæt 1' }).click();
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveCount(0);
  const bar = page.getByRole('status', { name: 'Fortryd sletning' });
  await expect(bar).toContainText('Sæt slettet');
  await bar.getByRole('button', { name: 'Fortryd: Sæt slettet' }).click();

  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('80');
  await expect(bench.getByLabel('Reps sæt 1')).toHaveValue('5');
  await expect(bench.getByRole('button', { name: 'Udført sæt 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(bar).toBeHidden();
});

test('fortryder en fjernet øvelse og en annulleret træning; bjælken forsvinder af sig selv (#222)', async ({ page }) => {
  const workout = await startWithBench(page);
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByRole('button', { name: 'Fjern' }).click();
  await bench.getByRole('button', { name: 'Fjern?' }).click();
  await expect(bench).toHaveCount(0);

  const bar = page.getByRole('status', { name: 'Fortryd sletning' });
  await bar.getByRole('button', { name: 'Fortryd: Øvelse fjernet' }).click();
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('60');

  await workout.getByRole('button', { name: 'Annullér træning' }).click();
  await workout.getByRole('button', { name: 'Tryk igen for at bekræfte' }).click();
  await expect(workout).toBeHidden();
  await bar.getByRole('button', { name: 'Fortryd: Træning annulleret' }).click();
  await expect(workout).toBeVisible();
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('60');

  // Bjælken lukker efter et par sekunder
  await bench.getByRole('button', { name: 'Slet sæt 1' }).click();
  await expect(bar).toContainText('Sæt slettet');
  await page.clock.runFor(7000);
  await expect(bar).toBeHidden();
});
