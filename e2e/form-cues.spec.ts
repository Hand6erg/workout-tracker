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

test('"?" på øvelseskortet viser tips uden at miste udfyldte sæt (#339)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByRole('button', { name: 'Start Push' }).click();
  const card = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await card.getByLabel('Vægt sæt 1').fill('62,5');
  await card.getByLabel('Reps sæt 1').fill('7');
  // Kortets top holder sig på én linje ved 360 px
  const head = card.locator('header');
  const h = await head.boundingBox();
  const btn = await card.getByRole('button', { name: 'Teknik for Bænkpres' }).boundingBox();
  expect(Math.abs(btn!.y + btn!.height / 2 - (h!.y + h!.height / 2))).toBeLessThan(6);
  expect(h!.height).toBeLessThan(60);
  const remove = await card.getByRole('button', { name: 'Fjern' }).boundingBox();
  const box = await card.boundingBox();
  expect(remove!.x + remove!.width).toBeLessThanOrEqual(box!.x + box!.width);
  await card.getByRole('button', { name: 'Teknik for Bænkpres' }).click();
  const sheet = page.getByRole('dialog', { name: 'Teknik: Bænkpres' });
  await expect(sheet.getByRole('listitem')).toHaveCount(4);
  await expect(sheet).toContainText('Stangen ned mod brystbenet');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/339-cues-sheet.png' });
  await sheet.getByRole('button', { name: 'Luk' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(card.getByLabel('Vægt sæt 1')).toHaveValue('62,5');
  await expect(card.getByLabel('Reps sæt 1')).toHaveValue('7');
  await page.screenshot({ path: 'test-results/339-card.png' });
});

test('egen øvelse uden tips har ingen "?" (#339)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: '+ Ny' }).click();
  const dlg = page.getByRole('dialog', { name: 'Ny øvelse' });
  await dlg.getByLabel('Navn').fill('Hip thrust');
  await dlg.getByRole('button', { name: 'Gem øvelse' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  await page.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('hip');
  await picker.getByRole('button', { name: /^Hip thrust/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const card = page.getByRole('article', { name: 'Hip thrust' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'Teknik for Hip thrust' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Bænkpres', exact: true }).getByRole('button', { name: 'Teknik for Bænkpres' })).toBeVisible();
});
