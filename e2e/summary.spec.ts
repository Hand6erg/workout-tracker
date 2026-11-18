import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function pushWorkout(page: Page, weight: string) {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill(weight);
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
}

test('viser en opsummering efter "Afslut", og "Luk" går tilbage til Træning (#143)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await bench.getByRole('button', { name: '+ Tilføj sæt' }).click();
  await bench.getByRole('button', { name: 'Udført sæt 2' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();

  const summary = page.getByRole('region', { name: 'Opsummering' });
  await expect(summary.getByRole('heading', { name: 'Godt gået! 💪' })).toBeVisible();
  await expect(summary).toContainText('800 kg');
  await expect(summary).toContainText('2 sæt');
  await expect(summary.getByRole('status')).toHaveCount(0); // ingen tidligere træning at sammenligne med
  await page.screenshot({ path: 'test-results/summary.png' });

  await summary.getByRole('button', { name: 'Luk' }).click();
  await expect(summary).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Træning', level: 1 })).toBeVisible();
});

test('viser + % volumen og 🏆 når samme skabelon løftes tungere (#143)', async ({ page }) => {
  await pushWorkout(page, '80');
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
  await pushWorkout(page, '100');

  const summary = page.getByRole('region', { name: 'Opsummering' });
  await expect(summary.getByRole('status')).toHaveText('+25 % volumen siden sidst');
  await expect(summary.getByRole('region', { name: 'Nye rekorder' })).toContainText('Bænkpres');
  await page.screenshot({ path: 'test-results/summary-records.png' });
});

test('opsummeringen er væk efter genindlæsning (#143)', async ({ page }) => {
  await pushWorkout(page, '80');
  await expect(page.getByRole('region', { name: 'Opsummering' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Opsummering' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start Push' })).toBeVisible();
});

test('"Del" downloader opsummeringen som PNG, når telefonen ikke kan dele filer (#144)', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await page.reload();
  await pushWorkout(page, '80');
  const summary = page.getByRole('region', { name: 'Opsummering' });
  await page.screenshot({ path: 'test-results/summary-share.png' });

  const [download] = await Promise.all([page.waitForEvent('download'), summary.getByRole('button', { name: 'Del' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^loeft-\d{4}-\d{2}-\d{2}\.png$/);
  const data = Buffer.concat(await (await download.createReadStream()).toArray());
  expect(data.subarray(1, 4).toString('ascii')).toBe('PNG');
  await download.saveAs('test-results/share-card.png');
});
