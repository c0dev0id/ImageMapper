import { expect, openApp, storedProject, test } from './app.ts'

test('the base map menu lists the maps of the world first, then each region once', async ({ page }) => {
  await openApp(page)
  const groups = await page
    .getByRole('combobox', { name: 'Base map' })
    .locator('optgroup')
    .evaluateAll((all) => all.map((group) => (group as HTMLOptGroupElement).label))
  expect(groups[0]).toBe('World')
  expect(new Set(groups).size).toBe(groups.length)
  expect(groups).toEqual(expect.arrayContaining(['Germany', 'USA']))
})

test('a regional map, once picked, loads its tiles and shows its credits', async ({ page, requests }) => {
  await openApp(page, { view: { center: [8.3, 61.6], zoom: 12, bearing: 0, pitch: 0 } })
  await page.getByRole('combobox', { name: 'Base map' }).selectOption({ label: 'Kartverket Topo' })
  await expect.poll(() => requests.filter((url) => url.includes('cache.kartverket.no')).length).toBeGreaterThan(0)
  await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toContainText('Kartverket')
  await expect.poll(async () => (await storedProject(page)).baseMap).toBe('kartverket')
})

test('where TopPlusOpen sends transparent tiles, the last zoom with data is fetched', async ({ page, requests }) => {
  // The mock has data to z13, as TopPlusOpen has outside Europe.
  await openApp(page, { baseMap: 'topplusopen', view: { center: [-105.6, 40.3], zoom: 15, bearing: 0, pitch: 0 } })
  const zooms = () =>
    requests.map((url) => Number(url.match(/wmts_topplus_open\/.*\/WEBMERCATOR\/(\d+)\//)?.[1])).filter(Boolean)
  // MapLibre asks for a parent tile only once the tile of the view's zoom has come back missing.
  await expect.poll(zooms).toContain(13)
  expect(Math.max(...zooms())).toBeGreaterThanOrEqual(15)
})

test('the satellite asks Esri to answer missing zooms with 404s, not placeholder tiles', async ({ page, requests }) => {
  await openApp(page, { satelliteOpacity: 0.5 })
  const imagery = () => requests.filter((url) => url.includes('World_Imagery'))
  await expect.poll(() => imagery().length).toBeGreaterThan(0)
  for (const url of imagery()) expect(url).toMatch(/\?blankTile=false$/)
})
