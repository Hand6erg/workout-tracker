import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('ugeplan på startskærmen: kun med plan, og tæller afsluttede træninger (#324)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const card = page.getByRole('region', { name: 'Ugeplan' });
  await expect(page.getByRole('heading', { name: 'Træning', exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);

  await page.getByRole('button', { name: 'Profil' }).click();
  const days = page.getByRole('region', { name: 'Træningsdage' });
  for (const d of ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']) {
    await days.getByRole('button', { name: d }).click();
  }
  await page.getByRole('button', { name: 'Træning', exact: true }).click();
  await expect(card.getByText('I dag: træningsdag 💪')).toBeVisible();
  await expect(card.getByText('0 af 7 planlagte træninger denne uge')).toBeVisible();
  await expect(card.getByRole('listitem', { name: /\(i dag\): planlagt, ikke trænet$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Start Ben' }).click();
  const ex = page.getByRole('article', { name: 'Squat', exact: true });
  await ex.getByLabel('Vægt sæt 1').fill('60');
  await ex.getByLabel('Reps sæt 1').fill('8');
  await ex.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  await expect(card.getByText('1 af 7 planlagte træninger denne uge')).toBeVisible();
  await expect(card.getByRole('listitem', { name: /\(i dag\): planlagt, trænet$/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/week-plan-start.png' });
});
