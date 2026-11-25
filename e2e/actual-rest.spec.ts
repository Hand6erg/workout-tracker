import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 20, 17, 0) });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('"hvilede 2:40" under sættet i træningen og i Historik (#316)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const bench = workout.getByRole('article', { name: 'Bænkpres', exact: true });

  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(bench.getByText(/hvilede/)).toHaveCount(0); // intet under træningens første sæt

  await bench.getByRole('button', { name: '+ Tilføj sæt' }).click();
  await page.clock.fastForward(160_000);
  await bench.getByRole('button', { name: 'Udført sæt 2' }).click();
  await expect(bench.getByText('hvilede 2:40')).toBeVisible();
  await expect(bench.getByText(/hvilede/)).toHaveCount(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.getByRole('button', { name: 'Spring over' }).click();
  await bench.screenshot({ path: 'test-results/actual-rest.png' });

  // Fjern krydset → teksten forsvinder; sæt det igen
  await bench.getByRole('button', { name: 'Udført sæt 2' }).click();
  await expect(bench.getByText(/hvilede/)).toHaveCount(0);
  await bench.getByRole('button', { name: 'Udført sæt 2' }).click();
  await expect(bench.getByText(/^hvilede 2:4\d$/)).toBeVisible();

  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  await page.getByRole('button', { name: 'Historik' }).click();
  await page.getByRole('button', { name: /^Træning / }).first().click();
  const detail = page.getByRole('dialog');
  await expect(detail).toContainText(/80 kg × 5 · hvilede 2:4\d/);
  await expect(detail.getByText(/hvilede/)).toHaveCount(1);
});
