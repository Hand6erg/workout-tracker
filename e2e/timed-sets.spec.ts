import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function startWith(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill(search);
  await picker.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  return { workout, card: workout.getByRole('article', { name, exact: true }) };
}

async function finishAndOpenHistory(page: Page) {
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await expect(workout).toBeHidden();
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await page.getByRole('button', { name: /^Træning / }).click();
}

test('Planke: stopuret tæller op og udfylder sekunderne (#134)', async ({ page }) => {
  const { card } = await startWith(page, 'plank', 'Planke');
  await expect(card.getByRole('columnheader', { name: 'Sek.' })).toBeVisible();
  await expect(card.getByLabel('Vægt sæt 1')).toHaveCount(0);

  await card.getByRole('button', { name: 'Start stopur sæt 1' }).click();
  await page.clock.runFor(12_000);
  await expect(card.getByLabel('Sekunder sæt 1')).toHaveValue('12');
  // Stopuret tåler en genindlæsning, fordi starttidspunktet er gemt
  await page.reload();
  await page.clock.runFor(18_000);
  await page.screenshot({ path: 'test-results/timed-set-running.png' });
  await card.getByRole('button', { name: 'Stop stopur sæt 1' }).click();
  // Uret kører også i virkelig tid under skærmbilledet, så et sekund ekstra er ok
  await expect(card.getByLabel('Sekunder sæt 1')).toHaveValue(/^3[01]$/);
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(card.getByRole('button', { name: 'Udført sæt 1' })).toHaveAttribute('aria-pressed', 'true');

  await finishAndOpenHistory(page);
  await expect(page.getByRole('dialog')).toContainText(/3[01] sek\./);
});

test('Romaskine: meter og tid vises som "500 m · 2:05" (#134)', async ({ page }) => {
  const { card } = await startWith(page, 'roma', 'Romaskine');
  await expect(card.getByRole('columnheader', { name: 'Meter' })).toBeVisible();
  await expect(card.getByRole('columnheader', { name: 'Tid' })).toBeVisible();
  await card.getByLabel('Meter sæt 1').fill('500');
  await card.getByLabel('Tid sæt 1').fill('2:05');
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(card.getByLabel('Tid sæt 1')).toHaveValue('2:05');
  await page.screenshot({ path: 'test-results/distance-set.png' });

  await finishAndOpenHistory(page);
  await expect(page.getByRole('dialog')).toContainText('500 m · 2:05');

  // Næste gang viser "Forrige" det samme format
  await page.keyboard.press('Escape');
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  const next = await startWith(page, 'roma', 'Romaskine');
  await expect(next.card.locator('td.prev').first()).toHaveText('500 m · 2:05');
  // Rækken må ikke flyde ud over kanten på en smal telefon
  await page.setViewportSize({ width: 360, height: 740 });
  const box = await next.card.getByRole('button', { name: 'Udført sæt 1' }).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  await page.screenshot({ path: 'test-results/distance-set-360.png' });
});

test('egen øvelse med typen "Tid" får et sekundfelt i træningen (#135)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: '+ Ny' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ny øvelse' });
  await dialog.getByLabel('Navn').fill('Wall sit');
  await dialog.getByLabel('Muskelgruppe').selectOption('Ben');
  await dialog.getByLabel('Udstyr').selectOption('Kropsvægt');
  await expect(dialog.getByLabel('Type')).toHaveValue('reps');
  await dialog.getByLabel('Type').selectOption('time');
  await dialog.getByRole('button', { name: 'Gem øvelse' }).click();
  await expect(page.getByRole('button', { name: /Wall sit.*Tid/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/135-exercise-list.png' });

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  const { card } = await startWith(page, 'wall', 'Wall sit');
  await expect(card.getByRole('columnheader', { name: 'Sek.' })).toBeVisible();
  await expect(card.getByLabel('Vægt sæt 1')).toHaveCount(0);
  await card.getByLabel('Sekunder sæt 1').fill('45');
  await expect(card.getByLabel('Sekunder sæt 1')).toHaveValue('45');
});

test('Planke 30 sek. og så 40 sek. giver rekorden "Længste hold 40 sek." (#136)', async ({ page }) => {
  const first = await startWith(page, 'plank', 'Planke');
  await first.card.getByLabel('Sekunder sæt 1').fill('30');
  await first.card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await finishAndOpenHistory(page);
  await page.keyboard.press('Escape');

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  const { card } = await startWith(page, 'plank', 'Planke');
  // Forslaget er +5 sek. og udfyldes i sekundfeltet
  await card.getByRole('button', { name: /Sidst: 30 sek\. Prøv 35 sek\./ }).click();
  await expect(card.getByLabel('Sekunder sæt 1')).toHaveValue('35');
  await card.getByLabel('Sekunder sæt 1').fill('40');
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(card.getByRole('img', { name: 'Ny rekord: længste hold' })).toBeVisible();
  await page.screenshot({ path: 'test-results/136-hold-record.png' });
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const newest = page.getByRole('button', { name: /^Træning / }).first();
  await expect(newest).toContainText('1 rekord');
  await expect(newest).toContainText('40 sek.');

  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByPlaceholder('Søg').fill('planke');
  await page.getByRole('button', { name: /^Planke/ }).click();
  const records = page.getByRole('region', { name: 'Rekorder' });
  await expect(records.getByRole('listitem').filter({ hasText: 'Længste hold' })).toContainText('40 sek.');
  await expect(page.getByRole('dialog', { name: 'Planke' })).not.toContainText('Est. 1RM');
  await page.screenshot({ path: 'test-results/136-exercise-page.png' });
});

test('Planke gemt som skabelon starter med et sekundfelt, og CSV har "Sek." (#137)', async ({ page }) => {
  const { card } = await startWith(page, 'plank', 'Planke');
  await card.getByLabel('Sekunder sæt 1').fill('45');
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await finishAndOpenHistory(page);
  await page.getByRole('button', { name: 'Gem som skabelon' }).click();
  await expect(page.getByRole('button', { name: 'Gemt som skabelon ✓' })).toBeVisible();
  await page.getByRole('button', { name: 'Luk' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Eksportér CSV' }).click()]);
  const csv = await (await download.createReadStream()).toArray();
  const text = Buffer.concat(csv).toString('utf8');
  expect(text.split('\n')[0]).toContain('Sek.,Meter');
  expect(text).toMatch(/,Planke,1,,,,45,/);

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  const tpl = page.getByRole('article', { name: /^Skabelon / }).last();
  await expect(tpl).toContainText('Planke');
  await tpl.getByRole('button', { name: /^Start/ }).click();
  const planke = page.getByRole('region', { name: 'Aktiv træning' }).getByRole('article', { name: 'Planke', exact: true });
  await expect(planke.getByRole('columnheader', { name: 'Sek.' })).toBeVisible();
  await expect(planke.getByLabel('Vægt sæt 1')).toHaveCount(0);
  await expect(planke.locator('td.prev').first()).toHaveText('45 sek.');
  await page.clock.runFor(1000);
  await page.screenshot({ path: 'test-results/137-template-plank.png' });
});
