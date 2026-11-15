import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('logger en hel træning fra start til historik', async ({ page }) => {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await expect(workout).toBeVisible();

  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();

  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(bench.getByRole('button', { name: 'Udført sæt 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status', { name: 'Pausetimer' })).toBeVisible();

  await bench.getByRole('button', { name: '+ Tilføj sæt' }).click();
  await expect(bench.getByLabel('Vægt sæt 2')).toHaveValue('80');
  await bench.getByRole('button', { name: 'Udført sæt 2' }).click();

  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await expect(workout).toBeHidden();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const card = page.getByRole('button', { name: /^Træning / });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('2 × Bænkpres');
  await expect(card).toContainText('800 kg');

  // Data overlever en genindlæsning
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByTestId('total-workouts')).toHaveText('1');

  // Øvelsens historik viser estimeret 1RM
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Bænkpres/ }).click();
  await expect(page.getByTestId('best-1rm')).toHaveText('93,3 kg');
});

test('starter fra skabelon og kan minimere træningen', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await expect(workout.getByRole('article')).toHaveCount(5);

  await workout.getByRole('button', { name: 'Minimér' }).click();
  await expect(workout).toBeHidden();
  await page.getByRole('button', { name: /^Push \d/ }).click();
  await expect(workout).toBeVisible();

  await workout.getByRole('button', { name: 'Annullér træning' }).click();
  await workout.getByRole('button', { name: 'Tryk igen for at bekræfte' }).click();
  await expect(page.getByRole('button', { name: 'Start tom træning' })).toBeVisible();
});

test('opretter en egen øvelse', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: '+ Ny' }).click();
  const dlg = page.getByRole('dialog', { name: 'Ny øvelse' });
  await dlg.getByLabel('Navn').fill('Hip thrust');
  await dlg.getByLabel('Muskelgruppe').selectOption('Ben');
  await dlg.getByRole('button', { name: 'Gem øvelse' }).click();
  await expect(page.getByRole('button', { name: /Hip thrust.*egen/ })).toBeVisible();
});

test('den rigtige app viser ikke testbjælken og gemmer under den rigtige nøgle', async ({ page }) => {
  await expect(page.getByText(/TESTVERSION/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('loeft-state-v1'))).not.toBeNull();
});

test('afslut gemmer udfyldte sæt, selvom de ikke er krydset af (#9)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();

  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('8');

  await workout.getByRole('button', { name: 'Afslut' }).click();
  const dialog = page.getByRole('dialog', { name: 'Afslut træning' });
  await expect(dialog).toContainText('1 sæt er udfyldt');
  await dialog.getByRole('button', { name: 'Gem alle udfyldte sæt' }).click();

  await expect(workout).toHaveCount(0);
  await page.getByRole('button', { name: 'Historik' }).click();
  await expect(page.getByText('Bænkpres').first()).toBeVisible();
});

test('viser 🏆 når et sæt slår en rekord (#16)', async ({ page }) => {
  async function benchSet(weight: string, reps: string) {
    await page.getByRole('button', { name: 'Start tom træning' }).click();
    const workout = page.getByRole('region', { name: 'Aktiv træning' });
    await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
    const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
    await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
    await picker.getByRole('button', { name: /^Bænkpres/ }).click();
    await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
    const bench = workout.getByRole('article', { name: 'Bænkpres', exact: true });
    await bench.getByLabel('Vægt sæt 1').fill(weight);
    await bench.getByLabel('Reps sæt 1').fill(reps);
    await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
    return { workout, bench };
  }

  const first = await benchSet('80', '5');
  await expect(first.bench.getByRole('img', { name: /Ny rekord/ })).toHaveCount(0); // første gang er ingen rekord
  await first.workout.getByRole('button', { name: 'Afslut' }).click();
  await first.workout.getByRole('button', { name: 'Bekræft' }).click();

  const second = await benchSet('85', '5');
  await expect(second.bench.getByRole('img', { name: 'Ny rekord: tungeste vægt, estimeret 1RM' })).toBeVisible();
  await second.bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(second.bench.getByRole('img', { name: /Ny rekord/ })).toHaveCount(0);
});

test('viser rekorder på øvelsens side (#22)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Bænkpres/ }).first().click();
  const detail = page.getByRole('dialog', { name: 'Bænkpres' });
  await expect(detail.getByRole('region', { name: 'Rekorder' })).toContainText('Ingen rekorder endnu');
  await detail.getByRole('button', { name: 'Luk' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('100');
  await bench.getByLabel('Reps sæt 1').fill('3');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Bænkpres/ }).first().click();
  const records = page.getByRole('dialog', { name: 'Bænkpres' }).getByRole('region', { name: 'Rekorder' });
  await expect(records).toContainText('Tungeste vægt');
  await expect(records).toContainText('100 kg × 3');
  await expect(records).toContainText('Flest reps på 100 kg');
});
test('viser 🏆 på træningskortet i historikken (#28)', async ({ page }) => {
  for (const weight of ['80', '90']) {
    await page.getByRole('button', { name: 'Start Push' }).click();
    const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
    await bench.getByLabel('Vægt sæt 1').fill(weight);
    await bench.getByLabel('Reps sæt 1').fill('5');
    await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
    await page.getByRole('button', { name: 'Afslut' }).click();
    await page.getByRole('button', { name: 'Bekræft' }).click();
  }
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const cards = page.getByRole('button', { name: 'Træning Push' });
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText('🏆 2 rekorder');
  await expect(cards.nth(0).getByRole('img', { name: 'Ny rekord' })).toBeVisible();
  await expect(cards.nth(1)).not.toContainText('🏆');
});
