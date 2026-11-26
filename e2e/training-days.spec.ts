import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('"Træningsdage" i Profil: vælg dage, de huskes efter genindlæsning (#323)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole('button', { name: 'Profil' }).click();
  const section = page.getByRole('region', { name: 'Træningsdage' });
  await expect(section.getByText('Hviledage er en del af planen.')).toBeVisible();
  for (const d of ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']) {
    await expect(section.getByRole('button', { name: d })).toHaveAttribute('aria-pressed', 'false');
  }
  await section.getByRole('button', { name: 'Mandag' }).click();
  await section.getByRole('button', { name: 'Onsdag' }).click();
  await section.getByRole('button', { name: 'Fredag' }).click();

  // Alle syv knapper passer i bredden
  const box = await section.getByRole('button', { name: 'Søndag' }).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/training-days-profile.png' });

  await page.reload();
  await page.getByRole('button', { name: 'Profil' }).click();
  for (const d of ['Mandag', 'Onsdag', 'Fredag']) {
    await expect(section.getByRole('button', { name: d })).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(section.getByRole('button', { name: 'Tirsdag' })).toHaveAttribute('aria-pressed', 'false');
  await section.getByRole('button', { name: 'Onsdag' }).click();
  await expect(section.getByRole('button', { name: 'Onsdag' })).toHaveAttribute('aria-pressed', 'false');
});
