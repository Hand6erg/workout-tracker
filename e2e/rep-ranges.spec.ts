import { expect, test } from '@playwright/test';

test('rep-interval på en skabelon: "3 × 8–12" på kortet og som placeholder i træningen (#258)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();

  const card = page.getByRole('article', { name: 'Skabelon Push' });
  await expect(card).toContainText('Bænkpres 3 sæt');
  await card.getByRole('button', { name: 'Rediger reps i Push' }).click();

  const sheet = page.getByRole('dialog', { name: 'Reps: Push' });
  // Ugyldigt interval afvises med en forklaring
  await sheet.getByLabel('Fra Bænkpres').fill('12');
  await sheet.getByLabel('Til Bænkpres').fill('8');
  await sheet.getByRole('button', { name: 'Gem' }).click();
  await expect(sheet.getByRole('alert')).toContainText('Bænkpres');
  await sheet.getByLabel('Fra Bænkpres').fill('8');
  await sheet.getByLabel('Til Bænkpres').fill('12');
  await sheet.getByRole('button', { name: 'Gem' }).click();
  await expect(sheet).toBeHidden();
  await expect(card).toContainText('Bænkpres 3 × 8–12');

  // Overlever genindlæsning
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await expect(card).toContainText('Bænkpres 3 × 8–12');

  // Feltet er udfyldt, når arket åbnes igen
  await card.getByRole('button', { name: 'Rediger reps i Push' }).click();
  await expect(sheet.getByLabel('Fra Bænkpres')).toHaveValue('8');
  await sheet.getByRole('button', { name: 'Luk' }).click();

  // Start skabelonen: reps-feltet viser "8–12"
  await card.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('region', { name: 'Aktiv træning' }).getByRole('article', { name: 'Bænkpres', exact: true });
  await expect(bench.getByLabel('Reps sæt 1')).toHaveAttribute('placeholder', '8–12');
  await expect(bench.getByLabel('Reps sæt 3')).toHaveAttribute('placeholder', '8–12');
});

test('tomme felter fjerner rep-intervallet igen (#258)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  const card = page.getByRole('article', { name: 'Skabelon Push' });
  await card.getByRole('button', { name: 'Rediger reps i Push' }).click();
  const sheet = page.getByRole('dialog', { name: 'Reps: Push' });
  await sheet.getByLabel('Fra Bænkpres').fill('5');
  await sheet.getByRole('button', { name: 'Gem' }).click();
  await expect(card).toContainText('Bænkpres 3 × 5');
  await card.getByRole('button', { name: 'Rediger reps i Push' }).click();
  await sheet.getByLabel('Fra Bænkpres').fill('');
  await sheet.getByLabel('Til Bænkpres').fill('');
  await sheet.getByRole('button', { name: 'Gem' }).click();
  await expect(card).toContainText('Bænkpres 3 sæt');
});
