import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
});

test('sætter programmets rækkefølge i Profil, og den overlever en genindlæsning', async ({ page }) => {
  const program = page.getByRole('region', { name: 'Program' });
  await expect(program).toContainText('Sæt dine skabeloner i rækkefølge');

  await program.getByRole('button', { name: 'Tilføj Push til program' }).click();
  await program.getByRole('button', { name: 'Tilføj Pull til program' }).click();
  const order = program.getByRole('list', { name: 'Programmets rækkefølge' }).getByRole('listitem');
  await expect(order).toHaveText([/Push/, /Pull/]);

  await order.filter({ hasText: 'Pull' }).getByRole('button', { name: 'Flyt op' }).click();
  await expect(order).toHaveText([/Pull/, /Push/]);

  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByRole('region', { name: 'Program' }).getByRole('listitem')).toHaveText([/Pull/, /Push/]);
});

test('fjerner en skabelon fra programmet', async ({ page }) => {
  const program = page.getByRole('region', { name: 'Program' });
  await program.getByRole('button', { name: 'Tilføj Push til program' }).click();
  await program.getByRole('button', { name: 'Tilføj Ben til program' }).click();
  const order = program.getByRole('listitem');
  await expect(order).toHaveCount(2);

  await order.filter({ hasText: 'Push' }).getByRole('button', { name: 'Fjern fra program' }).click();
  await expect(order).toHaveText([/Ben/]);
  await expect(program.getByRole('button', { name: 'Tilføj Push til program' })).toBeVisible();
});

test('en slettet skabelon forsvinder fra programmet', async ({ page }) => {
  const program = page.getByRole('region', { name: 'Program' });
  await program.getByRole('button', { name: 'Tilføj Push til program' }).click();
  await program.getByRole('button', { name: 'Tilføj Pull til program' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  const push = page.getByRole('article', { name: 'Skabelon Push' });
  await push.getByRole('button', { name: '✕' }).click();
  await push.getByRole('button', { name: 'Slet?' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByRole('region', { name: 'Program' }).getByRole('listitem')).toHaveText([/Pull/]);
});
