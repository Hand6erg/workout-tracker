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

async function setProgram(page: import('@playwright/test').Page, names: string[]) {
  const program = page.getByRole('region', { name: 'Program' });
  for (const n of names) await program.getByRole('button', { name: `Tilføj ${n} til program` }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
}

test('startskærmen viser næste skabelon i programmet og går videre efter en træning (#108)', async ({ page }) => {
  await setProgram(page, ['Push', 'Pull']);
  const next = page.getByRole('region', { name: 'Næste i programmet' });
  await expect(next.getByRole('heading')).toHaveText('Næste: Push');

  await next.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  const first = workout.getByRole('article').first();
  await first.getByLabel('Vægt sæt 1').fill('50');
  await first.getByLabel('Reps sæt 1').fill('5');
  await first.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click(); // opsummeringen (#143)
  await expect(workout).toBeHidden();

  await expect(next.getByRole('heading')).toHaveText('Næste: Pull');
});

test('"Spring over" går videre til den følgende skabelon (#108)', async ({ page }) => {
  await setProgram(page, ['Pull', 'Push']);
  const next = page.getByRole('region', { name: 'Næste i programmet' });
  await expect(next.getByRole('heading')).toHaveText('Næste: Pull');
  await next.getByRole('button', { name: 'Spring over' }).click();
  await expect(next.getByRole('heading')).toHaveText('Næste: Push');
});

test('uden program vises intet "Næste"-kort (#108)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await expect(page.getByRole('button', { name: 'Start tom træning' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Næste i programmet' })).toHaveCount(0);
});
