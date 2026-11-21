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

test('med kropsvægt 80 i Profil tæller 10 pull-ups som 800 kg i opsummering og Historik (#207)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await page.getByLabel('Kropsvægt (kg)', { exact: true }).fill('80');
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();

  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('pull-up');
  await picker.getByRole('button', { name: /^Pull-up/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const pullup = workout.getByRole('article', { name: 'Pull-up' });
  await pullup.getByLabel('Reps sæt 1').fill('10');
  await pullup.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();

  const summary = page.getByRole('region', { name: 'Opsummering' });
  await expect(summary).toContainText('800 kg');
  await summary.getByRole('button', { name: 'Luk' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await expect(page.getByText('🏋️ 800 kg')).toBeVisible();
});

async function startPullups(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('pull-up');
  await picker.getByRole('button', { name: /^Pull-up/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  return { workout, pullup: workout.getByRole('article', { name: 'Pull-up' }) };
}

test('pull-ups med KV, +10 og −20 vises som "KV × …" i Historik (#208)', async ({ page }) => {
  await page.goto('./');
  const { workout, pullup } = await startPullups(page);
  // Uden kropsvægt vises et hint én gang for øvelsen
  await expect(pullup.getByText('Angiv din kropsvægt i Profil for at tælle den med')).toHaveCount(1);
  await expect(pullup.getByRole('columnheader', { name: '+kg' })).toBeVisible();
  await expect(pullup.getByLabel('Ekstra vægt sæt 1')).toHaveAttribute('placeholder', 'KV');
  await expect(pullup.getByRole('button', { name: 'Tilføj opvarmning' })).toHaveCount(0);
  await pullup.getByRole('button', { name: '+ Tilføj sæt' }).click();
  await pullup.getByRole('button', { name: '+ Tilføj sæt' }).click();
  await pullup.getByLabel('Reps sæt 1').fill('10');
  await pullup.getByLabel('Ekstra vægt sæt 2').fill('10');
  await pullup.getByLabel('Reps sæt 2').fill('8');
  await pullup.getByLabel('Ekstra vægt sæt 3').fill('-20');
  await pullup.getByLabel('Reps sæt 3').fill('6');
  for (const n of [1, 2, 3]) await pullup.getByRole('button', { name: `Udført sæt ${n}` }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('region', { name: 'Opsummering' }).getByRole('button', { name: 'Luk' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await page.getByRole('button', { name: /^Træning / }).first().click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByText('KV × 10', { exact: true })).toBeVisible();
  await expect(detail.getByText('KV +10 × 8', { exact: true })).toBeVisible();
  await expect(detail.getByText('KV −20 × 6', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Luk' }).click();

  // "Forrige" i næste træning
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  const next = await startPullups(page);
  await expect(next.pullup.locator('td.prev').first()).toHaveText('KV×10');
});

test('med kropsvægt i Profil vises intet hint, og normale øvelser har "kg" som før (#208)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await page.getByLabel('Kropsvægt (kg)', { exact: true }).fill('80');
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  const { workout, pullup } = await startPullups(page);
  await expect(pullup.getByText('Angiv din kropsvægt i Profil for at tælle den med')).toHaveCount(0);
  await pullup.getByLabel('Ekstra vægt sæt 1').fill('10');
  await pullup.getByLabel('Reps sæt 1').fill('5');
  await pullup.getByRole('button', { name: 'Udført sæt 1' }).click();

  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænkpres');
  await picker.getByRole('button', { name: /^Bænkpres/ }).first().click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const bench = workout.getByRole('article', { name: /Bænkpres/ }).first();
  await expect(bench.getByRole('columnheader', { name: 'kg', exact: true })).toBeVisible();
  await expect(bench.getByLabel('Vægt sæt 1')).toBeVisible();

  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  // (80 + 10) × 5 = 450 kg
  await expect(page.getByRole('region', { name: 'Opsummering' })).toContainText('450 kg');
});

test('en egen øvelse med udstyret "Kropsvægt" logges som "KV +5 × …" (#209)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: '+ Ny' }).click();
  const dlg = page.getByRole('dialog', { name: 'Ny øvelse' });
  await dlg.getByLabel('Navn').fill('Ringrows');
  await dlg.getByLabel('Muskelgruppe').selectOption('Ryg');
  await dlg.getByLabel('Udstyr').selectOption('Kropsvægt');
  await dlg.getByRole('button', { name: 'Gem øvelse' }).click();
  await page.getByRole('button', { name: /Ringrows.*egen/ }).click();
  await expect(page.getByRole('dialog', { name: 'Ringrows' }).getByText('Kropsvægt + ekstra vægt')).toBeVisible();
  await page.getByRole('dialog', { name: 'Ringrows' }).getByRole('button', { name: 'Luk' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('ringrows');
  await picker.getByRole('button', { name: /^Ringrows/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const ex = workout.getByRole('article', { name: 'Ringrows' });
  await ex.getByLabel('Ekstra vægt sæt 1').fill('5');
  await ex.getByLabel('Reps sæt 1').fill('12');
  await ex.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('region', { name: 'Opsummering' }).getByRole('button', { name: 'Luk' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await expect(page.getByText('KV +5 × 12', { exact: true })).toBeVisible();

  // Næste gang: 12 reps på alle sæt → forslag om 2,5 kg mere
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  await picker.getByPlaceholder('Søg efter øvelse').fill('ringrows');
  await picker.getByRole('button', { name: /^Ringrows/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const hint = workout.getByRole('article', { name: 'Ringrows' }).getByRole('button', { name: /Sidst: 1 × 12 @ KV \+5\. Prøv KV \+7,5/ });
  await expect(hint).toBeVisible();
  await hint.click();
  await expect(workout.getByRole('article', { name: 'Ringrows' }).getByLabel('Ekstra vægt sæt 1')).toHaveValue('7,5');
});
