import { expect, test, type Page } from '@playwright/test';

async function logBench(page: Page, kg: string, reps: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill(kg);
  await bench.getByLabel('Reps sæt 1').fill(reps);
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

async function openBench(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Bænkpres/ }).first().click();
  return page.getByRole('dialog', { name: 'Bænkpres' });
}

test('sæt et mål "100 kg × 1" på Bænkpres – fremskridt og e1RM vises, og målet kan slettes (#199)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await logBench(page, '80', '1');

  const detail = await openBench(page);
  const goals = detail.getByRole('region', { name: 'Mål' });
  await goals.getByRole('button', { name: '+ Sæt mål' }).click();

  // Tom vægt kan ikke gemmes
  const save = goals.getByRole('button', { name: 'Gem mål' });
  await expect(save).toBeDisabled();
  await goals.getByLabel('Mål-vægt (kg)').fill('100');
  await goals.getByLabel('Reps').fill('1');
  await expect(goals.getByLabel('Måldato (valgfri)')).toBeVisible();
  await expect(save).toBeEnabled();
  await save.click();

  const row = goals.getByRole('listitem', { name: 'Mål 100 kg × 1' });
  await expect(row).toBeVisible();
  await expect(row.getByRole('progressbar', { name: 'Fremskridt mod 100 kg × 1' })).toHaveAttribute('aria-valuenow', '80');
  await expect(row).toContainText('Nu: 80 kg e1RM');
  await page.screenshot({ path: 'test-results/goals-section.png' });

  // Målet huskes
  await page.reload();
  const again = await openBench(page);
  const row2 = again.getByRole('listitem', { name: 'Mål 100 kg × 1' });
  await expect(row2).toBeVisible();

  // Slet (to tryk)
  await row2.getByRole('button', { name: 'Slet mål' }).click();
  await row2.getByRole('button', { name: 'Tryk igen for at slette' }).click();
  await expect(again.getByRole('listitem', { name: 'Mål 100 kg × 1' })).toHaveCount(0);
});

test('et nået mål vises under "Nået" med dato, og tidsøvelser har ingen mål (#199)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  let detail = await openBench(page);
  const goals = detail.getByRole('region', { name: 'Mål' });
  await goals.getByRole('button', { name: '+ Sæt mål' }).click();
  await goals.getByLabel('Mål-vægt (kg)').fill('60');
  await goals.getByRole('button', { name: 'Gem mål' }).click();
  await detail.getByRole('button', { name: 'Luk' }).click();

  await logBench(page, '60', '3');
  detail = await openBench(page);
  await expect(detail.getByRole('heading', { name: 'Nået' })).toBeVisible();
  await expect(detail.getByRole('listitem', { name: 'Mål 60 kg × 1' })).toContainText('✓ Nået');
  await detail.getByRole('button', { name: 'Luk' }).click();

  await page.getByRole('button', { name: /^Planke/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Planke' }).getByRole('region', { name: 'Mål' })).toHaveCount(0);
});

async function setGoal(page: Page, name: string, kg: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  const detail = page.getByRole('dialog', { name });
  const goals = detail.getByRole('region', { name: 'Mål' });
  await goals.getByRole('button', { name: '+ Sæt mål' }).click();
  await goals.getByLabel('Mål-vægt (kg)').fill(kg);
  await goals.getByRole('button', { name: 'Gem mål' }).click();
  await detail.getByRole('button', { name: 'Luk' }).click();
}

test('Profil viser alle mål sorteret efter fremskridt, og et tryk åbner øvelsen (#200)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Uden mål: en hint-tekst
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const empty = page.getByRole('region', { name: 'Mål', exact: true });
  await expect(empty).toContainText('Sæt et mål på en øvelses side');

  await setGoal(page, 'Bænkpres', '70');
  await logBench(page, '80', '1');
  await setGoal(page, 'Bænkpres', '100');
  await setGoal(page, 'Squat', '120');

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const goals = page.getByRole('region', { name: 'Mål', exact: true });
  const rows = goals.getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAccessibleName('Mål Bænkpres 100 kg × 1');
  await expect(rows.nth(1)).toHaveAccessibleName('Mål Squat 120 kg × 1');
  await expect(goals.getByRole('progressbar', { name: 'Fremskridt mod Bænkpres 100 kg × 1' })).toHaveAttribute('aria-valuenow', '80');
  await expect(goals.getByRole('progressbar', { name: 'Fremskridt mod Squat 120 kg × 1' })).toHaveAttribute('aria-valuenow', '0');

  // Det nåede mål (70 kg) ligger sammenklappet under "Nået (1)"
  await goals.getByRole('button', { name: /Nået \(1\)/ }).click();
  await expect(goals.getByRole('listitem', { name: 'Nået mål Bænkpres 70 kg × 1' })).toContainText('✓ Nået');
  await goals.getByRole('button', { name: /Nået \(1\)/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/profile-goals.png' });

  await goals.getByRole('button', { name: 'Åbn Squat 120 kg × 1' }).click();
  await expect(page.getByRole('dialog', { name: 'Squat' })).toBeVisible();
});
