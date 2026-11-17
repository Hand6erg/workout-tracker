import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('bytter Bænkpres med et forslag og beholder sættet (#127)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  const bench = workout.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');

  await bench.getByRole('button', { name: 'Byt Bænkpres' }).click();
  const dialog = page.getByRole('dialog', { name: 'Byt øvelse' });
  const suggestions = dialog.getByRole('region', { name: 'Forslag' });
  await expect(suggestions.getByRole('button', { name: /^Dips/ })).toBeVisible();
  // Skrå bænkpres er allerede i træningen og foreslås ikke
  await expect(suggestions.getByRole('button', { name: /^Skrå bænkpres/ })).toHaveCount(0);
  await page.waitForTimeout(300); // åbne-animationen
  await page.screenshot({ path: 'test-results/swap-dialog.png' });
  await suggestions.getByRole('button', { name: /^Dips/ }).click();

  await expect(dialog).toHaveCount(0);
  await expect(workout.getByRole('article', { name: 'Bænkpres', exact: true })).toHaveCount(0);
  const dips = workout.getByRole('article', { name: 'Dips', exact: true });
  await expect(dips.getByLabel('Vægt sæt 1')).toHaveValue('80');
  await expect(dips.getByLabel('Reps sæt 1')).toHaveValue('5');
});

test('søgning i "Byt øvelse" finder øvelser uden for forslagene (#127)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('article', { name: 'Bænkpres', exact: true }).getByRole('button', { name: 'Byt Bænkpres' }).click();
  const dialog = page.getByRole('dialog', { name: 'Byt øvelse' });
  await expect(dialog.getByRole('region', { name: 'Forslag' }).getByRole('button', { name: /^Squat/ })).toHaveCount(0);
  await dialog.getByLabel('Søg i alle øvelser').fill('squat');
  await dialog.getByRole('region', { name: 'Søgeresultater' }).getByRole('button', { name: /^Squat/ }).click();
  await expect(workout.getByRole('article', { name: 'Squat', exact: true })).toBeVisible();
});
