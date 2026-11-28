import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function legDay(page: Page) {
  await page.getByRole('button', { name: 'Start Ben' }).click();
  for (const name of ['Squat', 'Rumænsk dødløft']) {
    const ex = page.getByRole('article', { name, exact: true });
    for (const n of [1, 2, 3]) {
      await ex.getByLabel(`Vægt sæt ${n}`).fill('60');
      await ex.getByLabel(`Reps sæt ${n}`).fill('8');
      await ex.getByRole('button', { name: `Udført sæt ${n}` }).click();
    }
  }
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

test('"Restitution" viser Ben som hårdt trænet og Bryst som klar efter en bendag (#287)', async ({ page }) => {
  const card = page.getByRole('region', { name: 'Restitution' });
  await expect(card).toHaveCount(0); // ingen historik endnu

  await legDay(page);
  await expect(card).toBeVisible();
  await expect(card.getByRole('listitem', { name: /^Ben: Hårdt trænet, i dag, 6 sæt de sidste 7 dage$/ })).toBeVisible();
  await expect(card.getByRole('listitem', { name: /^Bryst: Klar, ikke trænet endnu/ })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/recovery.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);

  // Skjult under en træning
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  await page.getByRole('button', { name: 'Minimér' }).click();
  await expect(page.getByRole('button', { name: /Fortsæt/ })).toBeVisible();
  await expect(card).toHaveCount(0);
});

test('"Skjul" på restitutionskortet huskes efter genindlæsning (#287)', async ({ page }) => {
  await legDay(page);
  const card = page.getByRole('region', { name: 'Restitution' });
  await card.getByRole('button', { name: 'Skjul' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(0);
  await page.reload();
  await expect(card.getByRole('button', { name: 'Vis' })).toBeVisible();
  await expect(card.getByRole('listitem')).toHaveCount(0);
  await card.getByRole('button', { name: 'Vis' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(6);
});

test('Tryk på "Ben" åbner bendagen, og "Klar" står på Push men ikke Ben (#288)', async ({ page }) => {
  await legDay(page);
  const card = page.getByRole('region', { name: 'Restitution' });
  // Bryst er aldrig trænet – ingen knap
  await expect(card.getByRole('button', { name: 'Vis seneste træning for Bryst' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Vis seneste træning for Ben' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Squat').first()).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: 'test-results/recovery-detail.png' });
  await dialog.getByRole('button', { name: 'Luk', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  const ready = 'Klar – trænes mest muskler, der er hvilede';
  await expect(page.getByRole('article', { name: 'Skabelon Push' }).getByRole('img', { name: ready })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Skabelon Ben' }).getByRole('img', { name: ready })).toHaveCount(0);
  await page.getByRole('article', { name: 'Skabelon Push' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/recovery-ready.png' });
});

test('En ny app viser ingen "Klar"-mærker (#288)', async ({ page }) => {
  await expect(page.getByRole('article', { name: /^Skabelon / }).first()).toBeVisible();
  await expect(page.getByRole('img', { name: /^Klar – / })).toHaveCount(0);
});
