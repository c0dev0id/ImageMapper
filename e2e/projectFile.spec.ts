import { addImage, expect, openApp, storedProject, test } from './app.ts'

test('a saved project file brings back images, routes and waypoints after New', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept())
  await openApp(page, {
    name: 'Eifel tour',
    view: { center: [6.9, 50.35], zoom: 11, bearing: 0, pitch: 0 },
    routes: [
      {
        id: 'r1',
        name: 'Day one',
        profile: 'car',
        color: '#e03131',
        points: [
          { id: 'p1', lngLat: [6.85, 50.33] },
          { id: 'p2', lngLat: [6.95, 50.37], straight: true },
        ],
        legs: {},
      },
    ],
    waypoints: [{ id: 'w1', lngLat: [6.9, 50.36], name: 'Viewpoint' }],
  })
  await addImage(page, 'eifel.png')
  const before = await storedProject(page)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await download).suggestedFilename()).toBe('Eifel tour.imgmap')
  const file = await (await download).path()

  await page.getByRole('button', { name: 'New' }).click()
  await expect.poll(async () => (await storedProject(page)).routes).toEqual([])
  expect((await storedProject(page)).layers).toEqual([])

  await page.locator('input[type=file][accept^=".imgmap"]').setInputFiles(file)
  await expect.poll(async () => (await storedProject(page)).name).toBe('Eifel tour')
  const after = await storedProject(page)
  expect(after.layers.map(({ name, width, height, placement }) => ({ name, width, height, placement }))).toEqual(
    before.layers.map(({ name, width, height, placement }) => ({ name, width, height, placement })),
  )
  expect(after.routes).toEqual(before.routes)
  expect(after.waypoints).toEqual(before.waypoints)
  await expect(page.getByRole('button', { name: /^Hide / })).toHaveCount(1)
})
