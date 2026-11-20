import { expect, test } from '@playwright/test';

async function openExercises(page: import('@playwright/test').Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
}

test('stjernemarker Squat på øvelsessiden – ★ i listen, "Favoritter" viser kun Squat, og det huskes (#191)', async ({ page }) => {
  await page.goto('./');
  await openExercises(page);
  await page.getByRole('button', { name: /^Squat/ }).click();
  const detail = page.getByRole('dialog', { name: 'Squat' });
  const star = detail.getByRole('button', { name: 'Favorit' });
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await expect(detail.getByRole('button', { name: 'Fjern favorit' })).toHaveAttribute('aria-pressed', 'true');
  await detail.getByRole('button', { name: 'Luk' }).click();

  await expect(page.getByRole('button', { name: 'Fjern favorit Squat' })).toHaveText('★');
  await page.getByRole('group', { name: 'Filtrer øvelser' }).getByRole('button', { name: 'Favoritter' }).click();
  await expect(page.locator('.fav-row')).toHaveCount(1);
  await expect(page.locator('.fav-row')).toContainText('Squat');

  await page.reload();
  await openExercises(page);
  await expect(page.getByRole('button', { name: 'Fjern favorit Squat' })).toHaveAttribute('aria-pressed', 'true');
});

test('fjern stjernen fra listen – øvelsen forsvinder fra "Favoritter" (#191)', async ({ page }) => {
  await page.goto('./');
  await openExercises(page);
  await page.getByRole('button', { name: 'Favorit Squat', exact: true }).click();
  await page.getByRole('button', { name: 'Favorit Bænkpres', exact: true }).click();
  await page.getByRole('group', { name: 'Filtrer øvelser' }).getByRole('button', { name: 'Favoritter' }).click();
  await expect(page.locator('.fav-row')).toHaveCount(2);

  await page.getByRole('button', { name: 'Fjern favorit Squat' }).click();
  await expect(page.locator('.fav-row')).toHaveCount(1);
  await expect(page.locator('.fav-row')).toContainText('Bænkpres');
  await page.getByRole('button', { name: 'Fjern favorit Bænkpres' }).click();
  await expect(page.getByText('Ingen favoritter endnu')).toBeVisible();
});
