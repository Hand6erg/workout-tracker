import { expect, test, type Page } from '@playwright/test';

async function logBench(page: Page, kg: string, reps: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill(kg);
  await bench.getByLabel('Reps sæt 1').fill(reps);
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

async function openBench(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Bænkpres/ }).first().click();
  return page.getByRole('dialog', { name: 'Bænkpres' });
}

test('procenttabel på øvelsessiden: 80 % = 80 kg og skiver pr. side (#251)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Ingen historik → ingen rækker endnu
  let detail = await openBench(page);
  const empty = detail.getByRole('region', { name: 'Procenttabel' });
  await empty.getByRole('button', { name: /Procenttabel/ }).click();
  await expect(empty).toContainText('Log et sæt eller skriv din testede 1RM');
  await expect(empty.getByRole('button', { name: /^80 %/ })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Luk', exact: true }).click();

  await logBench(page, '100', '1');
  detail = await openBench(page);
  const table = detail.getByRole('region', { name: 'Procenttabel' });
  await table.getByRole('button', { name: /Procenttabel/ }).click();
  await expect(table).toContainText('Bygger på: estimeret 1RM (100 kg)');
  const row = table.getByRole('button', { name: '80 % – 80 kg' });
  await expect(row).toBeVisible();
  await expect(table.getByRole('button', { name: '95 % – 95 kg' })).toBeVisible();
  await expect(table.getByRole('button', { name: '50 % – 50 kg' })).toBeVisible();
  await row.click();
  await expect(table).toContainText('25 + 5 pr. side');

  // Ingen vandret scroll på telefonbredde
  const overflow = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"] .pct-table') as HTMLElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/percent-table.png' });
});

test('testet 1RM: 120 kg giver 80 % = 95 kg, huskes efter genindlæsning, og "Brug estimat" går tilbage (#252)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await logBench(page, '100', '1');

  let detail = await openBench(page);
  let table = detail.getByRole('region', { name: 'Procenttabel' });
  await table.getByRole('button', { name: /Procenttabel/ }).click();
  await table.getByLabel('Testet 1RM (kg)').fill('120');
  await expect(table).toContainText('Bygger på: testet 1RM (120 kg)');
  await expect(table.getByRole('button', { name: '80 % – 95 kg' })).toBeVisible();
  await page.screenshot({ path: 'test-results/percent-table-tested.png' });

  await page.reload();
  detail = await openBench(page);
  table = detail.getByRole('region', { name: 'Procenttabel' });
  await table.getByRole('button', { name: /Procenttabel/ }).click();
  await expect(table.getByLabel('Testet 1RM (kg)')).toHaveValue('120');
  await expect(table.getByRole('button', { name: '80 % – 95 kg' })).toBeVisible();

  await table.getByRole('button', { name: 'Brug estimat' }).click();
  await expect(table.getByLabel('Testet 1RM (kg)')).toHaveValue('');
  await expect(table).toContainText('Bygger på: estimeret 1RM (100 kg)');
  await expect(table.getByRole('button', { name: '80 % – 80 kg' })).toBeVisible();
});

test('en backup med testet 1RM kan gendannes (#252)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await logBench(page, '100', '1');
  let detail = await openBench(page);
  let table = detail.getByRole('region', { name: 'Procenttabel' });
  await table.getByRole('button', { name: /Procenttabel/ }).click();
  await table.getByLabel('Testet 1RM (kg)').fill('110');
  await detail.getByRole('button', { name: 'Luk', exact: true }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tag backup (JSON)' }).click()]);
  const file = await download.path();

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await page.locator('input[type="file"]').setInputFiles(file!);
  await expect(page.getByRole('status')).toContainText('Gendannet 1 træninger');

  detail = await openBench(page);
  table = detail.getByRole('region', { name: 'Procenttabel' });
  await table.getByRole('button', { name: /Procenttabel/ }).click();
  await expect(table.getByLabel('Testet 1RM (kg)')).toHaveValue('110');
  await expect(table).toContainText('Bygger på: testet 1RM (110 kg)');
});
