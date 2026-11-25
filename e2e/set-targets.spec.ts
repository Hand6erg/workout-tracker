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

test('"Ugens sæt"-ringe opdateres live i træningen og vises på startskærmen (#302)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  const rings = workout.getByRole('region', { name: 'Ugens sæt' });
  await expect(rings.getByRole('img', { name: 'Bryst: 0 af 12 sæt denne uge' })).toBeVisible();

  const bench = workout.getByRole('article', { name: 'Bænkpres', exact: true });
  for (const n of [1, 2, 3]) {
    await bench.getByLabel(`Vægt sæt ${n}`).fill('60');
    await bench.getByLabel(`Reps sæt ${n}`).fill('8');
    await bench.getByRole('button', { name: `Udført sæt ${n}` }).click();
  }
  await expect(rings.getByRole('img', { name: 'Bryst: 3 af 12 sæt denne uge' })).toBeVisible();
  await expect(rings).toContainText('3/12');
  await page.screenshot({ path: 'test-results/set-rings-workout.png' });

  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: /Bekræft/ }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  const start = page.getByRole('region', { name: 'Ugens sæt' });
  await expect(start).toContainText('Bryst');
  await expect(start.getByRole('img', { name: 'Bryst: 3 af 12 sæt denne uge' })).toBeVisible();
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(scroll).toBe(true);
  await start.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/set-rings-start.png' });
});

test('ingen ringe når alle mål er slået fra (#302)', async ({ page }) => {
  await page.getByRole('button', { name: 'Profil' }).click();
  const section = page.getByRole('region', { name: 'Ugentlige sæt' });
  for (const m of ['Bryst', 'Ryg', 'Ben', 'Skuldre', 'Arme', 'Mave']) await section.getByLabel(`Slå mål for ${m} fra`).check();
  await page.getByRole('button', { name: 'Træning' }).click();
  await expect(page.getByRole('heading', { name: 'Skabeloner' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ugens sæt' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Push' }).click();
  await expect(page.getByRole('region', { name: 'Aktiv træning' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ugens sæt' })).toHaveCount(0);
});
