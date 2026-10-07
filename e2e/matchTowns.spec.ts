import { fromMercator, mercatorPerPixel, toMercator } from '../src/geo/mercator.ts'
import type { LngLat } from '../src/geo/types.ts'
import { addImage, expect, onMap, openApp, storedProject, test, type Place } from './app.ts'

const VIEW = { center: [7.85, 50.55] as LngLat, zoom: 9, bearing: 0, pitch: 0 }
const CANVAS = { width: 960, height: 800 }
const SCALE = 1.15

/** The town printed at a spot of the view (fractions of the map canvas) lies 15 % farther from the middle on the map. */
function placeAt(name: string, fx: number, fy: number): Place {
  const [cx, cy] = toMercator(VIEW.center)
  const unit = mercatorPerPixel(VIEW.zoom) * SCALE
  const [lon, lat] = fromMercator([cx + (fx - 0.5) * CANVAS.width * unit, cy + (fy - 0.5) * CANVAS.height * unit])
  return { name, display_name: `${name}, Westerwaldkreis, Deutschland`, lat: String(lat), lon: String(lon) }
}

// Spots on the image, clear of the dialog, which opens at the top right.
const TOWNS: readonly { name: string; spot: [number, number] }[] = [
  { name: 'Hachenburg', spot: [0.28, 0.32] },
  { name: 'Westerburg', spot: [0.7, 0.55] },
  { name: 'Montabaur', spot: [0.4, 0.72] },
]

test.use({ places: Object.fromEntries(TOWNS.map(({ name, spot }) => [name, [placeAt(name, ...spot)]])) })

test('towns searched, picked and tapped on the image place it, with the help shown once', async ({ page }) => {
  await openApp(page, { view: VIEW })
  expect(await page.locator('.maplibregl-canvas').boundingBox()).toMatchObject(CANVAS)
  await addImage(page)
  const before = (await storedProject(page)).layers[0].placement
  const tools = page.getByRole('toolbar', { name: 'Tools' })
  await tools.getByRole('button', { name: 'Match Towns', exact: true }).click()

  const help = page.getByRole('dialog', { name: 'Placing an image' })
  await expect(help).toBeVisible()
  await help.getByRole('button', { name: 'Close help' }).click()
  const dialog = page.getByRole('dialog', { name: 'Match towns' })

  for (const [i, { name, spot }] of TOWNS.entries()) {
    const town = dialog.getByRole('searchbox', { name: `Town ${i + 1}` })
    await town.fill(name)
    await town.press('Enter')
    await dialog.locator('.search-results button.result').first().click()
    await dialog.getByRole('button', { name: `Pick ${name} on the image` }).click()
    await page.mouse.click(...(await onMap(page, ...spot)))
    // A tap counts once it has proved not to start a drag.
    await expect(dialog.getByText('Spot picked on the image')).toHaveCount(i + 1)
  }
  await dialog.getByRole('button', { name: 'Match', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.note').filter({ hasText: 'Placed by Hachenburg, Westerburg and Montabaur' })).toBeVisible()

  // Towns place the image without leaving point pairs; its corners move 15 % away from the middle.
  await expect.poll(async () => (await storedProject(page)).layers[0].placement).not.toEqual(before)
  const layer = (await storedProject(page)).layers[0]
  expect(layer.gcps).toEqual([])
  const centre = toMercator(VIEW.center)
  const corners = before.map(({ image, map }) => {
    const [x, y] = toMercator(map)
    return { image, map: [centre[0] + SCALE * (x - centre[0]), centre[1] + SCALE * (y - centre[1])] }
  })
  const pixel = mercatorPerPixel(VIEW.zoom)
  for (const { image, map } of corners) {
    const placed = layer.placement.find((pair) => pair.image[0] === image[0] && pair.image[1] === image[1])!
    const [x, y] = toMercator(placed.map)
    expect(Math.hypot(x - map[0], y - map[1])).toBeLessThan(pixel)
  }

  // The help does not come back.
  await tools.getByRole('button', { name: 'Match Towns', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(help).toBeHidden()
})
