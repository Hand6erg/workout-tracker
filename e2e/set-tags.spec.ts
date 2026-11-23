import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
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
  return workout.getByRole('article', { name: 'Bænkpres' });
}

test('mærk sæt 2 som "Til failure" og fjern mærket igen (#244)', async ({ page }) => {
  const bench = await startWithBench(page);
  await bench.getByRole('button', { name: '+ Tilføj sæt' }).click();
  const no2 = bench.getByRole('button', { name: 'Valg for sæt 2' });
  await expect(no2).toHaveText('2');

  await no2.click();
  const menu = page.getByRole('dialog', { name: 'Sæt 2' });
  await menu.getByRole('button', { name: 'Til failure' }).click();
  await expect(menu).toBeHidden();
  await expect(no2).toHaveText('F');
  // Sættet er stadig sæt 2 med de samme felter
  await expect(bench.getByLabel('Vægt sæt 2')).toBeVisible();

  await no2.click();
  await expect(menu.getByRole('button', { name: 'Til failure' })).toHaveAttribute('aria-pressed', 'true');
  await menu.getByRole('button', { name: 'Fjern mærke' }).click();
  await expect(no2).toHaveText('2');

  // Opvarmning fra menuen, og menuen lukker med Escape
  await no2.click();
  await menu.getByRole('button', { name: 'Opvarmning' }).click();
  await expect(bench.getByRole('button', { name: 'Valg for opvarmning 1' })).toHaveText('O');
  await bench.getByRole('button', { name: 'Valg for opvarmning 1' }).click();
  await expect(page.getByRole('dialog', { name: 'Opvarmning 1' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('"Tilføj drop-sæt" på et 80 kg sæt giver et D-sæt på 65 kg lige under (#244)', async ({ page }) => {
  const bench = await startWithBench(page);
  await bench.getByRole('button', { name: '+ Tilføj sæt' }).click();
  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('8');

  await bench.getByRole('button', { name: 'Valg for sæt 1' }).click();
  await page.getByRole('dialog', { name: 'Sæt 1' }).getByRole('button', { name: '+ Tilføj drop-sæt' }).click();

  await expect(bench.getByLabel('Vægt drop-sæt 1')).toHaveValue('65');
  await expect(bench.getByRole('button', { name: 'Valg for drop-sæt 1' })).toHaveText('D');
  // Rækkefølge: sæt 1, drop-sæt, sæt 2
  await expect(bench.locator('.set-no')).toHaveText(['1', 'D', '2']);

  // Luk med ✕
  await bench.getByRole('button', { name: 'Valg for drop-sæt 1' }).click();
  await page.getByRole('dialog', { name: 'Drop-sæt 1' }).getByRole('button', { name: 'Luk' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
