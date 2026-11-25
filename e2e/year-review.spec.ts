import { expect, test, type Page } from '@playwright/test';

async function pushWorkout(page: Page, weight: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill(weight);
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

async function start(page: Page, at: Date) {
  await page.clock.setFixedTime(at);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

const history = (page: Page) => page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();

test('"Dit træningsår" vises i december og åbner en historie man kan bladre i (#309)', async ({ page }) => {
  await start(page, new Date(2026, 2, 10, 18));
  await pushWorkout(page, '80');
  await page.clock.setFixedTime(new Date(2026, 10, 10, 18));
  await pushWorkout(page, '100');
  await page.clock.setFixedTime(new Date(2026, 11, 5, 9));
  await page.reload();
  await history(page);

  const card = page.getByRole('region', { name: 'Dit træningsår 2026' });
  await expect(card).toBeVisible();
  await page.screenshot({ path: 'test-results/year-review-card.png', animations: 'disabled' });
  await card.getByRole('button', { name: /Dit træningsår 2026/ }).click();

  const story = page.getByRole('dialog', { name: 'Dit træningsår 2026' });
  await expect(story).toBeVisible();
  await expect(story).toContainText('2 træninger');
  await expect(story).toContainText('min under stangen');
  await expect(story.getByRole('button', { name: 'Forrige' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/year-review-1.png', animations: 'disabled' });
  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width).toBeLessThanOrEqual(0);

  await story.getByRole('button', { name: 'Næste' }).click();
  await expect(story).toContainText('Du løftede i alt');
  await story.getByRole('button', { name: 'Næste' }).click();
  await expect(story).toContainText('Din favoritøvelse');
  await expect(story).toContainText('Bænkpres');
  await page.screenshot({ path: 'test-results/year-review-2.png', animations: 'disabled' });
  // Gå frem til sidste slide
  while (await story.getByRole('button', { name: 'Næste' }).count()) {
    await story.getByRole('button', { name: 'Næste' }).click();
  }
  await expect(story).toContainText('Godt gået!');
  await page.screenshot({ path: 'test-results/year-review-3.png', animations: 'disabled' });
  await story.getByRole('button', { name: 'Forrige' }).click();
  await expect(story).toContainText('Sådan voksede dine løft');
  await story.getByRole('button', { name: 'Luk' }).click();
  await expect(story).toHaveCount(0);

  // Escape lukker også
  await card.getByRole('button', { name: /Dit træningsår 2026/ }).click();
  await expect(story).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(story).toHaveCount(0);
});

test('i juni vises kortet ikke, men et tidligere år kan åbnes (#309)', async ({ page }) => {
  await start(page, new Date(2025, 4, 10, 18));
  await pushWorkout(page, '80');
  await page.clock.setFixedTime(new Date(2026, 5, 10, 9));
  await page.reload();
  await history(page);
  await expect(page.getByRole('heading', { name: 'Historik' })).toBeVisible();
  await expect(page.getByRole('region', { name: /Dit træningsår/ })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Tidligere år' }).getByRole('button', { name: 'Dit træningsår 2025' }).click();
  const story = page.getByRole('dialog', { name: 'Dit træningsår 2025' });
  await expect(story).toContainText('1 træning');
  await story.getByRole('button', { name: 'Luk' }).click();
  await expect(story).toHaveCount(0);
});

test('"Skjul" fjerner kortet, også efter genindlæsning (#309)', async ({ page }) => {
  await start(page, new Date(2026, 11, 2, 18));
  await pushWorkout(page, '80');
  await history(page);
  const card = page.getByRole('region', { name: 'Dit træningsår 2026' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Skjul' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await history(page);
  await expect(page.getByRole('heading', { name: 'Historik' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Dit træningsår 2026' })).toHaveCount(0);
});
