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

async function finish(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click(); // opsummeringen (#143)
}

async function swapBenchToDips(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  const bench = workout.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Reps sæt 1').fill('8');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Spring over' }).click();
  await bench.getByRole('button', { name: 'Byt Bænkpres' }).click();
  await page.getByRole('dialog', { name: 'Byt øvelse' }).getByRole('button', { name: /^Dips/ }).click();
  return workout.getByRole('article', { name: 'Dips', exact: true });
}

test('"Gem i skabelonen" gør byttet permanent i Push (#128)', async ({ page }) => {
  const dips = await swapBenchToDips(page);
  const ask = dips.getByRole('group', { name: 'Gem byttet' });
  await expect(ask).toContainText('Push');
  await page.screenshot({ path: 'test-results/swap-template.png' });
  await ask.getByRole('button', { name: 'Gem i skabelonen' }).click();
  await expect(ask).toHaveCount(0);
  await expect(dips.getByRole('status')).toContainText('Gemt i skabelonen');
  await finish(page);

  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await expect(workout.getByRole('article', { name: 'Dips', exact: true })).toBeVisible();
  await expect(workout.getByRole('article', { name: 'Bænkpres', exact: true })).toHaveCount(0);
  await expect(workout.getByRole('article').first()).toHaveAccessibleName('Dips');
});

test('"Kun i dag" lader skabelonen være uændret (#128)', async ({ page }) => {
  const dips = await swapBenchToDips(page);
  await dips.getByRole('group', { name: 'Gem byttet' }).getByRole('button', { name: 'Kun i dag' }).click();
  await expect(dips.getByRole('group', { name: 'Gem byttet' })).toHaveCount(0);
  await finish(page);

  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await expect(workout.getByRole('article', { name: 'Bænkpres', exact: true })).toBeVisible();
  await expect(workout.getByRole('article', { name: 'Dips', exact: true })).toHaveCount(0);
});
