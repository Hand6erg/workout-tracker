import { expect, test } from '@playwright/test';

test('kropsvægt i Profil kan udfyldes og huskes efter genindlæsning (#206)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const field = page.getByLabel('Kropsvægt (kg)', { exact: true });
  await expect(field).toHaveValue('');
  await expect(page.getByText('Bruges til kropsvægtsøvelser, når du ikke har et kropsmål.')).toBeVisible();
  await field.fill('81,5');

  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByLabel('Kropsvægt (kg)', { exact: true })).toHaveValue('81,5');
  const saved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('loeft-state'))!;
    return JSON.parse(localStorage.getItem(key)!).bodyWeight;
  });
  expect(saved).toBe(81.5);

  // Tømt felt = ikke angivet
  await page.getByLabel('Kropsvægt (kg)', { exact: true }).fill('');
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByLabel('Kropsvægt (kg)', { exact: true })).toHaveValue('');
});
