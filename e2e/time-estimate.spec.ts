import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 20, 17, 0) });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Skabeloner viser "ca. … min", som følger den rigtige tid efter en træning (#280)', async ({ page }) => {
  const ben = page.getByRole('article', { name: 'Skabelon Ben' });
  // Ny skabelon: et dæmpet skøn ud fra sæt og pause
  const guess = ben.getByLabel(/^Anslået tid ca\. \d+ min \(skøn ud fra sæt og pause\)$/);
  await expect(guess).toBeVisible();
  await expect(guess).toHaveText(/⏱ ca\. \d+ min/);
  await expect(guess).toHaveAttribute('title', 'Skøn ud fra sæt og pause');

  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: 'test-results/time-estimate.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);

  // Træn Ben i 42 minutter
  await page.getByRole('button', { name: 'Start Ben' }).click();
  const squat = page.getByRole('article', { name: 'Squat', exact: true });
  await squat.getByLabel('Vægt sæt 1').fill('60');
  await squat.getByLabel('Reps sæt 1').fill('8');
  await squat.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.clock.fastForward(42 * 60_000);
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  const real = ben.getByLabel('Anslået tid ca. 40 min');
  await expect(real).toHaveText('⏱ ca. 40 min');
  await expect(real).toHaveAttribute('title', 'Gennemsnit af dine seneste træninger');
});
