import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function startWithBench(page: Page) {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  return workout;
}

test('fortryder et slettet sæt med samme vægt, reps og ✓ (#222)', async ({ page }) => {
  const workout = await startWithBench(page);
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();

  await bench.getByRole('button', { name: 'Valg for sæt 1' }).click();
  await page.getByRole('dialog', { name: 'Sæt 1' }).getByRole('button', { name: 'Slet sæt 1' }).click();
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveCount(0);
  const bar = page.getByRole('status', { name: 'Fortryd sletning' });
  await expect(bar).toContainText('Sæt slettet');
  await bar.getByRole('button', { name: 'Fortryd: Sæt slettet' }).click();

  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('80');
  await expect(bench.getByLabel('Reps sæt 1')).toHaveValue('5');
  await expect(bench.getByRole('button', { name: 'Udført sæt 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(bar).toBeHidden();
});

test('fortryder en fjernet øvelse og en annulleret træning; bjælken forsvinder af sig selv (#222)', async ({ page }) => {
  const workout = await startWithBench(page);
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByRole('button', { name: 'Fjern' }).click();
  await bench.getByRole('button', { name: 'Fjern?' }).click();
  await expect(bench).toHaveCount(0);

  const bar = page.getByRole('status', { name: 'Fortryd sletning' });
  await bar.getByRole('button', { name: 'Fortryd: Øvelse fjernet' }).click();
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('60');

  await workout.getByRole('button', { name: 'Annullér træning' }).click();
  await workout.getByRole('button', { name: 'Tryk igen for at bekræfte' }).click();
  await expect(workout).toBeHidden();
  await bar.getByRole('button', { name: 'Fortryd: Træning annulleret' }).click();
  await expect(workout).toBeVisible();
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('60');

  // Bjælken lukker efter et par sekunder
  await bench.getByRole('button', { name: 'Valg for sæt 1' }).click();
  await page.getByRole('dialog', { name: 'Sæt 1' }).getByRole('button', { name: 'Slet sæt 1' }).click();
  await expect(bar).toContainText('Sæt slettet');
  await page.clock.runFor(7000);
  await expect(bar).toBeHidden();
});

async function finishPush(page: Page) {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

test('fortryder en slettet træning i Historik – også i kalenderen og efter genindlæsning (#223)', async ({ page }) => {
  await finishPush(page);
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const card = page.getByRole('button', { name: 'Træning Push' });
  const day = page.getByRole('button', { name: /: Push$/ });
  await expect(day).toHaveCount(1);
  await card.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Slet' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tryk igen for at bekræfte' }).click();
  await expect(card).toHaveCount(0);
  await expect(day).toHaveCount(0);

  await page.getByRole('status', { name: 'Fortryd sletning' }).getByRole('button', { name: 'Fortryd: Træning slettet' }).click();
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('400 kg');
  await expect(day).toHaveCount(1);
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await expect(card).toHaveCount(1);
});

test('fortryder en slettet skabelon på samme plads og en slettet kropsmåling (#223)', async ({ page }) => {
  const templates = page.getByRole('article', { name: /^Skabelon / });
  const names = await templates.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const pull = page.getByRole('article', { name: 'Skabelon Pull' });
  await pull.getByRole('button', { name: '✕' }).click();
  await pull.getByRole('button', { name: 'Slet?' }).click();
  await expect(pull).toHaveCount(0);
  await page.getByRole('button', { name: 'Fortryd: Skabelon slettet' }).click();
  await expect(templates).toHaveCount(names.length);
  expect(await templates.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(names);

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const body = page.getByRole('region', { name: 'Kropsmål' });
  await body.getByLabel('Vægt (kg)').fill('82,5');
  await body.getByRole('button', { name: 'Gem måling' }).click();
  const list = body.getByRole('list', { name: 'Målinger' });
  await list.getByRole('button', { name: 'Slet' }).click();
  await list.getByRole('button', { name: 'Slet?' }).click();
  await expect(body).toContainText('Ingen målinger endnu.');
  await page.getByRole('button', { name: 'Fortryd: Måling slettet' }).click();
  await expect(list).toContainText('82,5 kg');
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(list).toContainText('82,5 kg');
});

test('bjælken forsvinder, når man skifter fane (#222)', async ({ page }) => {
  const pull = page.getByRole('article', { name: 'Skabelon Pull' });
  await pull.getByRole('button', { name: '✕' }).click();
  await pull.getByRole('button', { name: 'Slet?' }).click();
  const bar = page.getByRole('status', { name: 'Fortryd sletning' });
  await expect(bar).toContainText('Skabelon slettet');
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await expect(bar).toBeHidden();
});
