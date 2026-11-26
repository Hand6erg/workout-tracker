import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Øvelser → Bænkpres viser "Teknik" med tips (#338)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Bænkpres/ }).first().click();
  const detail = page.getByRole('dialog', { name: 'Bænkpres' });
  const cues = detail.getByRole('region', { name: 'Teknik' });
  await expect(cues).toBeVisible();
  await expect(cues.getByRole('listitem')).toHaveCount(4);
  await expect(cues).toContainText('Stangen ned mod brystbenet');
  // Indbyggede tips kan ikke redigeres
  await expect(cues.getByRole('button', { name: 'Redigér teknik' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/338-bench-cues.png' });
});

test('egne tips på en egen øvelse gemmes og vises efter genindlæsning (#338)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: '+ Ny' }).click();
  const dlg = page.getByRole('dialog', { name: 'Ny øvelse' });
  await dlg.getByLabel('Navn').fill('Hip thrust');
  await dlg.getByRole('button', { name: 'Gem øvelse' }).click();
  await page.getByRole('button', { name: /^Hip thrust/ }).first().click();

  let detail = page.getByRole('dialog', { name: 'Hip thrust' });
  let cues = detail.getByRole('region', { name: 'Teknik' });
  await expect(cues).toContainText('Ingen tips endnu');
  await cues.getByRole('button', { name: 'Redigér teknik' }).click();
  await cues.getByLabel('Dine tips (ét pr. linje)').fill('Skuldrene på bænken\n\n  Pres gennem hælene  ');
  await cues.getByRole('button', { name: 'Gem teknik' }).click();
  await expect(cues.getByRole('listitem')).toHaveText(['Skuldrene på bænken', 'Pres gennem hælene']);
  await page.screenshot({ path: 'test-results/338-custom-cues.png' });

  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Hip thrust/ }).first().click();
  detail = page.getByRole('dialog', { name: 'Hip thrust' });
  cues = detail.getByRole('region', { name: 'Teknik' });
  await expect(cues.getByRole('listitem')).toHaveText(['Skuldrene på bænken', 'Pres gennem hælene']);

  // Redigér igen: teksten er udfyldt, og tom tekst fjerner tipsene
  await cues.getByRole('button', { name: 'Redigér teknik' }).click();
  await expect(cues.getByLabel('Dine tips (ét pr. linje)')).toHaveValue('Skuldrene på bænken\nPres gennem hælene');
  await cues.getByLabel('Dine tips (ét pr. linje)').fill('');
  await cues.getByRole('button', { name: 'Gem teknik' }).click();
  await expect(cues).toContainText('Ingen tips endnu');
});
