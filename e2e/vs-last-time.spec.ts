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

test('tryk på "vs. sidst" viser hver øvelse i dag mod sidst og datoen; en byttet øvelse er "Ny i dag" (#177)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  for (const n of [1, 2, 3]) await benchSet(page, n, '80');
  const ohp = page.getByRole('article', { name: 'Militærpres', exact: true });
  await ohp.getByLabel('Vægt sæt 1').fill('50');
  await ohp.getByLabel('Reps sæt 1').fill('5');
  await ohp.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  for (const n of [1, 2, 3]) await benchSet(page, n, '85');
  // Byt Skrå bænkpres ud med Squat (ikke lavet sidst)
  await workout.getByRole('article', { name: 'Skrå bænkpres', exact: true }).getByRole('button', { name: 'Byt Skrå bænkpres' }).click();
  const swap = page.getByRole('dialog', { name: 'Byt øvelse' });
  await swap.getByLabel('Søg i alle øvelser').fill('squat');
  await swap.getByRole('region', { name: 'Søgeresultater' }).getByRole('button', { name: /^Squat/ }).click();

  await workout.getByTestId('vs-bar').click();
  const sheet = page.getByRole('dialog', { name: 'Mod sidst' });
  await expect(sheet).toContainText('Sammenlignet med');
  const today = new Date().toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'long' });
  await expect(sheet).toContainText(today);
  const benchRow = sheet.getByRole('row', { name: 'Bænkpres', exact: true });
  await expect(benchRow).toContainText('1.275 kg');
  await expect(benchRow).toContainText('1.200 kg');
  await expect(benchRow.getByRole('img', { name: 'Slog sidst' })).toBeVisible();
  const ohpRow = sheet.getByRole('row', { name: 'Militærpres', exact: true });
  await expect(ohpRow.getByRole('cell').nth(0)).toHaveText('–');
  await expect(ohpRow.getByRole('cell').nth(1)).toHaveText('250 kg');
  await expect(sheet.getByRole('row', { name: 'Squat', exact: true })).toContainText('Ny i dag');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/vs-last-sheet.png' });

  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await workout.getByTestId('vs-bar').click();
  await sheet.getByRole('button', { name: 'Luk' }).click();
  await expect(sheet).toHaveCount(0);
});
