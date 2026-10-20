import { centreOf, expect, onMap, openApp, test } from './app.ts'

const ZOOM = 12
const LATITUDE = 50.6
/** Metres per CSS pixel along the parallel through the centre, with MapLibre's earth radius. */
const METRES_PER_PIXEL = (2 * Math.PI * 6371008.8 * Math.cos((LATITUDE * Math.PI) / 180)) / (512 * 2 ** ZOOM)

/** The metres a label such as "4.85 km" or "850 m" stands for. */
function metres(label: string): number {
  const [value, unit] = label.split(' ')
  return Number(value) * (unit === 'km' ? 1000 : 1)
}

test('Measure shows the distance between two tapped points, follows a dragged end and keeps nothing', async ({
  page,
}) => {
  await openApp(page, { view: { center: [7.8, LATITUDE], zoom: ZOOM, bearing: 0, pitch: 0 } })
  const measure = page.getByRole('button', { name: 'Measure', exact: true })
  const hint = page.locator('.hint-bar')
  const ends = page.locator('.measure-end-marker')
  const distance = page.locator('.measure-distance')
  const width = (await page.locator('.maplibregl-canvas').boundingBox())!.width
  // The label is rounded to three digits; the rest is the pixel grid.
  const expectDistance = async (pixels: number) =>
    expect.poll(async () => Math.abs(metres(await distance.innerText()) / (pixels * METRES_PER_PIXEL) - 1)).toBeLessThan(0.01)
  // A tap counts once it has proved not to start a drag: wait for its end.
  const tap = async (fx: number, fy: number, count: number) => {
    await page.mouse.click(...(await onMap(page, fx, fy)))
    await expect(ends).toHaveCount(count)
  }

  await measure.click()
  await expect(measure).toHaveAttribute('aria-pressed', 'true')
  await expect(hint).toContainText('Tap where the distance to measure starts')
  await tap(0.25, 0.5, 1)
  await expect(hint).toContainText('Now tap where it ends')
  await tap(0.75, 0.5, 2)
  await expectDistance(width / 2)

  // Dragging the end to the middle halves the distance.
  await page.mouse.move(...(await centreOf(page, '.measure-end-marker:has(.measure-distance)')))
  await page.mouse.down()
  await page.mouse.move(...(await onMap(page, 0.5, 0.5)), { steps: 5 })
  await page.mouse.up()
  await expectDistance(width / 4)

  // A third tap starts a new distance.
  await tap(0.5, 0.3, 1)
  await expect(distance).toHaveCount(0)

  // Esc leaves the tool and its ends; nothing was an edit of the project.
  await page.keyboard.press('Escape')
  await expect(measure).toHaveAttribute('aria-pressed', 'false')
  await expect(ends).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
})

test('Measuring while a route is drawn adds no points, and Esc goes back to appending', async ({ page }) => {
  await openApp(page, { view: { center: [7.8, LATITUDE], zoom: ZOOM, bearing: 0, pitch: 0 } })
  const append = page.getByRole('button', { name: 'Append', exact: true })
  const ends = page.locator('.measure-end-marker')
  const points = page.locator('.route-point-marker')

  await page.getByRole('button', { name: 'Draw route' }).click()
  await page.getByRole('button', { name: 'Measure', exact: true }).click()
  await expect(append).toHaveAttribute('aria-pressed', 'false')
  await page.mouse.click(...(await onMap(page, 0.3, 0.5)))
  await expect(ends).toHaveCount(1)
  await page.mouse.click(...(await onMap(page, 0.7, 0.5)))
  await expect(ends).toHaveCount(2)
  await expect(page.locator('.measure-distance')).not.toBeEmpty()
  expect(await points.count()).toBe(0)

  await page.keyboard.press('Escape')
  await expect(append).toHaveAttribute('aria-pressed', 'true')
  await expect(ends).toHaveCount(0)
  await page.mouse.click(...(await onMap(page, 0.5, 0.5)))
  await expect(points).toHaveCount(1)
})
