import type { Pair } from '../src/geo/types.ts'
import { addImage, centreOf, expect, onMap, openApp, storedProject, test } from './app.ts'

const pairsOf = (pairs: readonly Pair[]) => pairs.map(({ image, map }) => ({ image, map }))

test('point pairs pinned on the image and the map skew the image onto them, and undo puts it back', async ({ page }) => {
  await openApp(page, { view: { center: [7.85, 50.55], zoom: 12, bearing: 0, pitch: 0 } })
  // A new image lies in the middle of the view, over 60 % of it.
  await addImage(page)
  const tap = async (fx: number, fy: number, button: 'left' | 'right' = 'left') =>
    page.mouse.click(...(await onMap(page, fx, fy)), { button })
  const hint = page.locator('.hint-bar')
  // A tap counts once it has proved not to start a drag: wait for what it does.
  const pin = async (image: [number, number], map: [number, number], pairs: number) => {
    await tap(...image)
    await expect(hint).toContainText('Now tap the same place on the map')
    await tap(...map)
    await expect(page.locator('.gcp-marker-map')).toHaveCount(pairs)
  }

  // Two pairs with the Pin tool: a spot on the image, then its place on the map.
  await page.getByRole('button', { name: 'Pin', exact: true }).click()
  await expect(hint).toContainText('Tap a spot on the image')
  await pin([0.35, 0.35], [0.3, 0.3], 1)
  await pin([0.65, 0.35], [0.7, 0.32], 2)
  await page.keyboard.press('Escape')

  // The third from the context menu.
  await tap(0.5, 0.65, 'right')
  await page.locator('.context-menu').getByRole('button', { name: 'Pin point on image' }).click()
  await expect(hint).toContainText('Now tap the same place on the map')
  await tap(0.52, 0.72)
  await expect(page.locator('.gcp-marker-map')).toHaveCount(3)

  await expect.poll(async () => (await storedProject(page)).layers[0].gcps.length).toBe(3)
  const { gcps, placement: corners } = (await storedProject(page)).layers[0]
  expect(corners).toHaveLength(4)

  await page.getByRole('button', { name: 'Skew Image', exact: true }).click()
  await expect.poll(async () => pairsOf((await storedProject(page)).layers[0].placement)).toEqual(pairsOf(gcps))
  // Each ring on the image now sits on its dot on the map.
  const ring = await centreOf(page, '.gcp-marker-image')
  const dot = await centreOf(page, '.gcp-marker-map')
  expect(Math.hypot(ring[0] - dot[0], ring[1] - dot[1])).toBeLessThan(1.5)

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(async () => (await storedProject(page)).layers[0].placement).toEqual(corners)

  // Pairs and placement survive a reload.
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect.poll(async () => pairsOf((await storedProject(page)).layers[0].placement)).toEqual(pairsOf(gcps))
  await page.reload()
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible()
  await expect(page.locator('.gcp-marker-image')).toHaveCount(3)
  expect(pairsOf((await storedProject(page)).layers[0].placement)).toEqual(pairsOf(gcps))
})
