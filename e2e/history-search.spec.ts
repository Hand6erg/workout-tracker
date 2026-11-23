import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

/** Logger en tom træning med én øvelse og ét sæt */
async function logOne(page: Page, search: string, name: RegExp, exercise: string, weight: string, reps: string) {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill(search);
  await picker.getByRole('button', { name }).first().click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const card = workout.getByRole('article', { name: exercise });
  await card.getByLabel('Vægt sæt 1').fill(weight);
  await card.getByLabel('Reps sæt 1').fill(reps);
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

test('"Søg i historik" viser kun træninger med øvelsen og fremhæver den; ✕ viser alle igen (#231)', async ({ page }) => {
  await logOne(page, 'bænk', /^Bænkpres/, 'Bænkpres', '80', '5');
  await logOne(page, 'squat', /^Squat/, 'Squat', '120', '3');

  await page.getByRole('button', { name: 'Historik' }).click();
  const cards = page.getByRole('button', { name: /^Træning / });
  await expect(cards).toHaveCount(2);

  await page.getByRole('searchbox', { name: 'Søg i historik' }).fill('SQUAT');
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1 træning med "SQUAT"');
  const hit = cards.first().locator('tr.search-hit');
  await expect(hit).toHaveCount(1);
  await expect(hit.locator('mark')).toHaveText('Squat');
  await expect(hit).toContainText('120 kg × 3');
  await page.screenshot({ path: 'test-results/history-search.png' });

  await page.getByRole('button', { name: 'Ryd søgning' }).click();
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('searchbox', { name: 'Søg i historik' })).toHaveValue('');
  await expect(page.locator('tr.search-hit')).toHaveCount(0);
});

test('en søgning uden træffere viser en tom-besked (#231)', async ({ page }) => {
  await logOne(page, 'bænk', /^Bænkpres/, 'Bænkpres', '80', '5');
  await page.getByRole('button', { name: 'Historik' }).click();
  await page.getByRole('searchbox', { name: 'Søg i historik' }).fill('dødløft');
  await expect(page.getByRole('status')).toHaveText('Ingen træninger matcher "dødløft"');
  await expect(page.getByRole('button', { name: /^Træning / })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/history-search-empty.png' });
});

/** Logger en træning fra en skabelon med ét udført sæt i første øvelse */
async function logTemplate(page: Page, template: string) {
  await page.getByRole('button', { name: `Start ${template}` }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  const card = workout.getByRole('article').first();
  await card.getByLabel('Vægt sæt 1').fill('60');
  await card.getByLabel('Reps sæt 1').fill('8');
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

test('skabelon-knapper filtrerer historikken, også sammen med søgning (#232)', async ({ page }) => {
  await logTemplate(page, 'Push');
  await logTemplate(page, 'Pull');
  await page.getByRole('button', { name: 'Historik' }).click();
  const cards = page.getByRole('button', { name: /^Træning / });
  await expect(cards).toHaveCount(2);

  const chips = page.getByRole('group', { name: 'Filtrér efter skabelon' });
  await expect(chips.getByRole('button')).toHaveText(['Alle', 'Push', 'Pull']);
  await chips.getByRole('button', { name: 'Push' }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAccessibleName('Træning Push');
  await expect(page.getByRole('status')).toHaveText('1 træning fra Push');
  await page.screenshot({ path: 'test-results/history-template-chips.png' });

  // Knap + søgetekst sammen: Bænkpres findes kun i Push
  const search = page.getByRole('searchbox', { name: 'Søg i historik' });
  await search.fill('bænkpres');
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1 træning med "bænkpres" fra Push');
  await chips.getByRole('button', { name: 'Pull' }).click();
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Ingen træninger matcher "bænkpres" fra Pull');

  await chips.getByRole('button', { name: 'Alle' }).click();
  await expect(cards).toHaveCount(1);
  await search.fill('');
  await expect(cards).toHaveCount(2);
  // Siden må ikke kunne scrolle sidelæns
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
