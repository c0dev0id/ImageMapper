import { expect, openApp, test } from './app.ts'

test.use({ firstVisit: true })

test('the About dialog opens on the first visit only, and again from the (i) beside the title', async ({ page }) => {
  await openApp(page)
  const about = page.getByRole('dialog', { name: 'About MapPic' })
  await expect(about).toBeVisible()
  await expect(about.locator('figure')).toHaveCount(3)
  await about.getByRole('button', { name: 'Close help' }).click()
  await expect(about).toBeHidden()

  await page.reload()
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible()
  await expect(about).toBeHidden()

  await page.getByRole('button', { name: 'About mappic' }).click()
  await expect(about).toBeVisible()
})
