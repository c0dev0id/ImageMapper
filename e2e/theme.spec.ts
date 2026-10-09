import type { Page } from '@playwright/test'
import { expect, openApp, test } from './app.ts'

const LIGHT = 'rgb(255, 255, 255)'
const DARK = 'rgb(26, 27, 30)'

const chosenTheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme)
const storedTheme = (page: Page) => page.evaluate(() => localStorage.getItem('image-mapper.theme'))
const panelBackground = (page: Page) => page.locator('.panel').evaluate((panel) => getComputedStyle(panel).backgroundColor)

test.describe('in a browser that prefers dark', () => {
  test.use({ colorScheme: 'dark' })

  test('the app starts dark', async ({ page }) => {
    await openApp(page)
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
    expect(await panelBackground(page)).toBe(DARK)
    expect(await chosenTheme(page)).toBeUndefined()
  })
})

test('the toggle overrides the preference until it is toggled back', async ({ page }) => {
  await openApp(page)
  expect(await panelBackground(page)).toBe(LIGHT)

  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  expect(await chosenTheme(page)).toBe('dark')
  expect(await panelBackground(page)).toBe(DARK)
  expect(await storedTheme(page)).toBe('dark')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
  expect(await panelBackground(page)).toBe(DARK)

  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  expect(await chosenTheme(page)).toBeUndefined()
  expect(await panelBackground(page)).toBe(LIGHT)
  expect(await storedTheme(page)).toBeNull()

  // Without a choice of its own, the app follows the browser as its preference changes.
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
  expect(await panelBackground(page)).toBe(DARK)
})
