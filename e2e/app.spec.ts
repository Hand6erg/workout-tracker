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

test('viser volumen pr. uge under Profil (#17)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const section = page.getByRole('region', { name: 'Volumen pr. uge' });
  await expect(section).toContainText('Afslut en træning');

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('100');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(section.getByRole('img', { name: /Volumen pr. uge.*Denne uge: 500 kg/ })).toBeVisible();
});

test('viser fordeling på muskelgrupper under Profil (#23)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Ben' }).click();
  const squat = page.getByRole('article', { name: 'Squat' });
  await squat.getByLabel('Vægt sæt 1').fill('100');
  await squat.getByLabel('Reps sæt 1').fill('5');
  await squat.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const section = page.getByRole('region', { name: 'Muskelgrupper' });
  await expect(section.getByRole('listitem').filter({ hasText: 'Ben' })).toContainText('1 sæt');
  await expect(section.getByRole('listitem').filter({ hasText: 'Bryst' })).toContainText('1 sæt');
  const all = section.getByRole('button', { name: 'Alt' });
  await all.click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(section.getByRole('button', { name: 'Sidste 4 uger' })).toHaveAttribute('aria-pressed', 'false');
});

test('tilføjer opvarmningssæt ud fra første arbejdssæt (#25)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  const add = bench.getByRole('button', { name: 'Tilføj opvarmning' });
  await add.click();
  await expect(bench.getByRole('status')).toContainText('Skriv vægten i sæt 1 først');
  await bench.getByLabel('Vægt sæt 1').fill('100');
  await expect(bench.getByRole('status')).toHaveCount(0);
  await add.click();
  await expect(bench.getByLabel('Vægt opvarmning 1')).toHaveValue('20');
  await expect(bench.getByLabel('Vægt opvarmning 4')).toHaveValue('80');
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('100');
  await expect(bench.getByRole('button', { name: 'Beregn opvarmning igen' })).toBeVisible();
});

test('ingen skiveknap i træningen, og stangvægten bruges til opvarmning (#113)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await page.getByRole('region', { name: 'Stang' }).getByLabel('Stangvægt').selectOption('15');

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await expect(bench.getByRole('button', { name: 'Skiver' })).toHaveCount(0);
  await bench.getByLabel('Vægt sæt 1').fill('100');
  await bench.getByRole('button', { name: 'Tilføj opvarmning' }).click();
  await expect(bench.getByLabel('Vægt opvarmning 1')).toHaveValue('15');
});

test('registrerer, viser og sletter kropsmål (#20)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const body = page.getByRole('region', { name: 'Kropsmål' });
  const save = body.getByRole('button', { name: 'Gem måling' });
  await expect(save).toBeDisabled();
  await body.getByLabel('Vægt (kg)').fill('82,5');
  await body.getByLabel('Talje (cm)').fill('88');
  await save.click();
  const list = body.getByRole('list', { name: 'Målinger' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('82,5 kg · talje 88 cm');
  await expect(body.getByLabel('Vægt (kg)')).toHaveValue('');

  await list.getByRole('button', { name: 'Slet' }).click();
  await list.getByRole('button', { name: 'Slet?' }).click();
  await expect(body).toContainText('Ingen målinger endnu.');
});

test('viser graf over kropsmål (#26)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const body = page.getByRole('region', { name: 'Kropsmål' });
  async function measure(date: string, weight: string) {
    await body.getByLabel('Dato').fill(date);
    await body.getByLabel('Vægt (kg)').fill(weight);
    await body.getByRole('button', { name: 'Gem måling' }).click();
  }
  await measure('2026-10-01', '84');
  await expect(body).toContainText('Tilføj flere målinger for at se en graf.');
  await measure('2026-11-01', '82,5');
  await expect(body.getByRole('img', { name: 'Vægt over tid: fra 84 til 82,5 kg' })).toBeVisible();
  await expect(body).toContainText('Ændring: -1,5 kg');
  await body.getByRole('button', { name: 'Talje' }).click();
  await expect(body).toContainText('Tilføj flere målinger for at se en graf.');
});

test('kropsmål kommer med i backup og gendannelse (#31)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const body = page.getByRole('region', { name: 'Kropsmål' });
  await body.getByLabel('Vægt (kg)').fill('81');
  await body.getByRole('button', { name: 'Gem måling' }).click();

  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksportér kropsmål (CSV)' }).click();
  expect((await csv).suggestedFilename()).toMatch(/^kropsmaal-.*\.csv$/);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tag backup (JSON)' }).click();
  const backup = await (await dl).path();

  await page.getByRole('button', { name: 'Slet alle data' }).click();
  await page.getByRole('button', { name: 'Tryk igen for at bekræfte' }).click();
  await expect(body).toContainText('Ingen målinger endnu.');

  await page.locator('input[type="file"]').setInputFiles(backup!);
  await expect(page.getByRole('status').filter({ hasText: 'Gendannet' })).toHaveText('Gendannet 0 træninger og 1 kropsmål.');
  await expect(body.getByRole('list', { name: 'Målinger' })).toContainText('81 kg');
});

test('kobler øvelser sammen i et supersæt (#18)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  const bench = workout.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByRole('button', { name: 'Supersæt med næste' }).click();
  const group = workout.getByRole('group', { name: 'Supersæt: Bænkpres + Militærpres' });
  await expect(group).toBeVisible();
  await expect(group.getByRole('article')).toHaveCount(2);
  await expect(bench.getByRole('button', { name: 'Supersæt med næste' })).toHaveCount(0);

  await group.getByRole('article', { name: 'Militærpres' }).getByRole('button', { name: 'Fjern fra supersæt' }).click();
  await expect(workout.getByRole('group', { name: /^Supersæt/ })).toHaveCount(0);
});

test('pausetimeren starter først når supersæt-runden er færdig (#24)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  const bench = workout.getByRole('article', { name: 'Bænkpres', exact: true });
  const ohp = workout.getByRole('article', { name: 'Militærpres' });
  await bench.getByRole('button', { name: 'Supersæt med næste' }).click();
  for (const ex of [bench, ohp]) {
    await ex.getByLabel('Vægt sæt 1').fill('40');
    await ex.getByLabel('Reps sæt 1').fill('8');
  }
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(page.getByRole('status', { name: 'Pausetimer' })).toHaveCount(0);
  await ohp.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(page.getByRole('status', { name: 'Pausetimer' })).toBeVisible();
});

test('supersæt bevares i skabelon og vises i historikken (#29)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: /^Roning/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (2)' }).click();
  await workout.getByRole('article', { name: 'Bænkpres', exact: true }).getByRole('button', { name: 'Supersæt med næste' }).click();
  for (const name of ['Bænkpres', 'Roning']) {
    const ex = workout.getByRole('article', { name, exact: true });
    await ex.getByLabel('Vægt sæt 1').fill('50');
    await ex.getByLabel('Reps sæt 1').fill('8');
    await ex.getByRole('button', { name: 'Udført sæt 1' }).click();
  }
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const card = page.getByRole('button', { name: /^Træning / }).first();
  await expect(card).toContainText('Supersæt: Bænkpres + Roning');
  await card.click();
  await page.getByRole('button', { name: 'Gem som skabelon' }).click();
  await page.getByRole('button', { name: 'Luk' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  const tpl = page.getByRole('article', { name: /^Skabelon / }).last();
  await expect(tpl).toContainText('Supersæt: 1× Bænkpres + 1× Roning');
  await tpl.getByRole('button', { name: /^Start/ }).click();
  await expect(page.getByRole('group', { name: 'Supersæt: Bænkpres + Roning' })).toBeVisible();
});

test('kalender i Historik markerer træningsdage og åbner træningen (#69)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const cal = page.getByRole('region', { name: /^Kalender / });
  await expect(cal).toContainText('1 træning i');
  await cal.getByRole('button', { name: /: Push$/ }).click();
  await expect(page.getByRole('dialog', { name: 'Push' })).toBeVisible();
  await page.getByRole('button', { name: 'Luk' }).click();

  await cal.getByRole('button', { name: 'Forrige måned' }).click();
  await expect(cal.getByRole('button', { name: /: Push$/ })).toHaveCount(0);
});

test('viser stime og ugemål under Profil (#70)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const streak = page.getByRole('region', { name: 'Stime' });
  await expect(streak).toContainText('0 af 2 træninger denne uge');
  await page.getByLabel('Mål: træninger pr. uge').fill('1');
  await expect(streak).toContainText('0 af 1 træning denne uge');

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(streak).toContainText('1 af 1 træning denne uge ✓');
  await expect(streak).toContainText('🔥 1 uge i træk');
});

test('viser forslag til næste vægt og udfylder med ét tryk (#72)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  let bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  for (const i of [1, 2, 3]) {
    await bench.getByLabel(`Vægt sæt ${i}`).fill('60');
    await bench.getByLabel(`Reps sæt ${i}`).fill('8');
    await bench.getByRole('button', { name: `Udført sæt ${i}` }).click();
  }
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('button', { name: 'Start Push' }).click();
  bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  const hint = bench.getByRole('button', { name: /^Sidst: 3 × 8 @ 60 kg\. Prøv 62,5 kg/ });
  await expect(hint).toBeVisible();
  await hint.click();
  for (const i of [1, 2, 3]) await expect(bench.getByLabel(`Vægt sæt ${i}`)).toHaveValue('62,5');
  await bench.getByLabel('Vægt sæt 1').fill('65');
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('65');
});

test('forslag til næste vægt kan slås fra (#73)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('8');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await page.getByLabel('Vis forslag til næste vægt').uncheck();
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  await expect(page.getByRole('article', { name: 'Bænkpres', exact: true }).getByRole('button', { name: /^Sidst/ })).toHaveCount(0);
});

test('note på en øvelse vises næste gang og i historikken (#100)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  let bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByRole('button', { name: 'Note til Bænkpres' }).click();
  await bench.getByLabel('Skriv note til Bænkpres').fill('sædehøjde 4');
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('8');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await page.getByRole('button', { name: 'Træning Push' }).click();
  await expect(page.getByRole('dialog').getByText('📝 sædehøjde 4')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await expect(bench.getByText('📝 Sidst: sædehøjde 4')).toBeVisible();
  await expect(bench.getByLabel('Skriv note til Bænkpres')).toHaveCount(0);
});

test('note til hele træningen vises på kortet og i detaljen (#101)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await page.getByLabel('Note til træningen').fill('sov dårligt');
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('8');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const card = page.getByRole('button', { name: 'Træning Push' });
  await expect(card.getByText('📝 sov dårligt')).toBeVisible();
  await card.click();
  await expect(page.getByRole('dialog').getByText('📝 sov dårligt')).toBeVisible();
});

test('træning uden note viser ingen tom notelinje (#101)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await page.getByLabel('Note til træningen').fill('   ');
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('8');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const card = page.getByRole('button', { name: 'Træning Push' });
  await expect(card).toBeVisible();
  await expect(card.getByText('📝')).toHaveCount(0);
  await card.click();
  await expect(page.getByRole('dialog').getByText('📝')).toHaveCount(0);
});

test('sætter træningen på pause og fortsætter (#115)', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await page.clock.runFor(65_000);
  await expect(workout.getByTestId('elapsed')).toHaveText('1:05');
  await workout.getByRole('button', { name: '⏸ Pause' }).click();
  await expect(workout.getByRole('status')).toContainText('sat på pause');
  await page.clock.runFor(120_000);
  await expect(workout.getByTestId('elapsed')).toHaveText('1:05');
  await workout.getByRole('button', { name: '▶ Fortsæt' }).click();
  await expect(workout.getByRole('status')).toHaveCount(0);
  await page.clock.runFor(10_000);
  await expect(workout.getByTestId('elapsed')).toHaveText('1:15');
});
