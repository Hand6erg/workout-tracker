import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('flytter Bænkpres ned, og det afkrydsede sæt bliver afkrydset (#376)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  const bench = workout.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Spring over' }).click();

  // Første øvelse kan ikke flyttes op, sidste ikke ned
  await expect(bench.getByRole('button', { name: 'Flyt Bænkpres op' })).toHaveCount(0);
  await expect(workout.getByRole('button', { name: 'Flyt Triceps pushdown ned' })).toHaveCount(0);

  await bench.getByRole('button', { name: 'Flyt Bænkpres ned' }).click();
  const cards = workout.getByRole('article');
  await expect(cards.first()).toHaveAttribute('aria-label', 'Militærpres');
  await expect(cards.nth(1)).toHaveAttribute('aria-label', 'Bænkpres');
  await expect(bench.getByRole('button', { name: 'Udført sæt 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('80');
  await expect(bench.getByRole('button', { name: 'Flyt Bænkpres op' })).toBeVisible();
  await page.waitForTimeout(400);
  await bench.screenshot({ path: 'test-results/reorder-card.png' });
});

test('et supersæt flytter som én blok (#376)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout
    .getByRole('article', { name: 'Militærpres', exact: true })
    .getByRole('button', { name: 'Supersæt med næste' })
    .click();
  await workout.getByRole('button', { name: 'Flyt Skrå bænkpres op' }).click();
  const cards = workout.getByRole('article');
  await expect(cards.first()).toHaveAttribute('aria-label', 'Militærpres');
  await expect(cards.nth(1)).toHaveAttribute('aria-label', 'Skrå bænkpres');
  await expect(cards.nth(2)).toHaveAttribute('aria-label', 'Bænkpres');
});

test('flytter en øvelse i en afsluttet træning fra Historik (#376)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  for (const name of ['Bænkpres', 'Militærpres']) {
    const card = page.getByRole('article', { name, exact: true });
    await card.getByLabel('Vægt sæt 1').fill('50');
    await card.getByLabel('Reps sæt 1').fill('5');
    await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  }
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await page.getByRole('button', { name: 'Træning Push' }).click();
  await page.getByRole('dialog', { name: 'Push' }).getByRole('button', { name: 'Redigér' }).click();
  const editor = page.getByRole('region', { name: 'Redigér træning' });
  await editor.getByRole('button', { name: 'Flyt Militærpres op' }).click();
  await expect(editor.getByRole('article').first()).toHaveAttribute('aria-label', 'Militærpres');
  await editor.getByRole('button', { name: 'Gem' }).click();
  await expect(editor).toHaveCount(0);

  await page.getByRole('button', { name: 'Træning Push' }).click();
  const titles = page.getByRole('dialog', { name: 'Push' }).getByRole('heading', { level: 3 });
  await expect(titles.first()).toHaveText('Militærpres');
  await expect(titles.nth(1)).toHaveText('Bænkpres');
});
