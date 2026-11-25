import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('"Ugentlige sæt" i Profil: mål ændres og slås fra og huskes (#301)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Profil' }).click();
  const section = page.getByRole('region', { name: 'Ugentlige sæt' });
  await expect(section.getByText('10–20 er et godt udgangspunkt')).toBeVisible();

  const ryg = section.getByLabel('Mål for Ryg pr. uge');
  await expect(ryg).toHaveValue('14');
  await ryg.fill('16');
  await section.getByLabel('Slå mål for Mave fra').check();
  await expect(section.getByLabel('Mål for Mave pr. uge')).toHaveCount(0);

  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/set-targets-profile.png' });

  await page.reload();
  await page.getByRole('button', { name: 'Profil' }).click();
  await expect(section.getByLabel('Mål for Ryg pr. uge')).toHaveValue('16');
  await expect(section.getByLabel('Slå mål for Mave fra')).toBeChecked();
  await expect(section.getByLabel('Mål for Mave pr. uge')).toHaveCount(0);

  // Slå Mave til igen → standardmålet kommer tilbage
  await section.getByLabel('Slå mål for Mave fra').uncheck();
  await expect(section.getByLabel('Mål for Mave pr. uge')).toHaveValue('8');
});
