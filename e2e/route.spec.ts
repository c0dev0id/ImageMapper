import { readFile } from 'node:fs/promises'
import { expect, onMap, openApp, storedProject, test } from './app.ts'

test('Line points are reached by straight legs that are never routed; Route goes back to routing', async ({
  page,
  requests,
}) => {
  const routed = () => requests.filter((url) => url.includes('routing.openstreetmap.de')).length
  const markers = page.locator('.route-point-marker')
  // A tap counts once it has proved not to start a drag: wait for its point.
  const tap = async (fx: number, fy: number) => {
    const points = await markers.count()
    await page.mouse.click(...(await onMap(page, fx, fy)))
    await expect(markers).toHaveCount(points + 1)
  }
  const route = page.getByRole('button', { name: 'Route', exact: true })
  const line = page.getByRole('button', { name: 'Line', exact: true })
  await openApp(page, { view: { center: [7.8, 50.6], zoom: 12, bearing: 0, pitch: 0 } })

  await page.getByRole('button', { name: 'Draw route' }).click()
  await expect(route).toHaveAttribute('aria-pressed', 'true')
  await tap(0.25, 0.6)
  await tap(0.4, 0.4)
  await expect.poll(routed).toBe(1)

  await line.click()
  await expect(line).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.hint-bar')).toContainText('straight lines')
  await tap(0.6, 0.45)
  await route.click()
  await tap(0.75, 0.65)
  await expect.poll(routed).toBe(2)

  // Inserting into the straight leg keeps both halves straight.
  const [second, third] = [(await markers.nth(1).boundingBox())!, (await markers.nth(2).boundingBox())!]
  await page.getByRole('button', { name: 'Insert', exact: true }).click()
  await page.mouse.click(
    (second.x + second.width / 2 + third.x + third.width / 2) / 2,
    (second.y + second.height / 2 + third.y + third.height / 2) / 2,
  )
  await expect(markers).toHaveCount(5)
  await expect.poll(async () => (await storedProject(page)).routes[0].points.map((p) => p.straight === true)).toEqual([
    false,
    false,
    true,
    true,
    false,
  ])
  expect(Object.keys((await storedProject(page)).routes[0].legs)).toHaveLength(2)
  expect(routed()).toBe(2)

  // GPX: each routed leg brings its detour point, each straight leg only its two ends.
  await page.locator('.hint-bar').getByRole('button', { name: 'Done' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export GPX' }).click()
  const gpx = await readFile(await (await download).path(), 'utf8')
  expect(gpx.match(/<trkpt /g)).toHaveLength(7)

  // After a reload, drawing starts with Route again and the straight legs stay unrouted.
  await page.reload()
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(route).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(1500) // the routing would have asked by now
  expect(routed()).toBe(2)
})
