import { test as base, expect, type Page, type Route } from '@playwright/test'
import type { LngLat } from '../src/geo/types.ts'
import { emptyProject, type Project } from '../src/state/schema.ts'
import { solidPng } from './png.ts'

export { expect }

/** A place as the mocked search returns it, in Nominatim's JSON. */
export interface Place {
  name: string
  display_name: string
  lat: string
  lon: string
}

const CORS = { 'access-control-allow-origin': '*' }
const TILE = solidPng(256, 256, [232, 228, 216, 255], [190, 180, 160, 255])
const EMPTY_TILE = solidPng(256, 256, [0, 0, 0, 0])
/** Every vector base map style: the grid tiles, without fonts or icons. */
const STYLE = {
  version: 8,
  sources: { grid: { type: 'raster', tiles: ['https://tiles.invalid/{z}/{x}/{y}.png'], tileSize: 256 } },
  layers: [{ id: 'grid', type: 'raster', source: 'grid' }],
}

/** Encodes points as OSRM's polyline6. */
function encodePolyline6(points: readonly LngLat[]): string {
  let out = ''
  let previous = [0, 0]
  for (const [lng, lat] of points) {
    const next = [Math.round(lat * 1e6), Math.round(lng * 1e6)]
    for (const delta of [next[0] - previous[0], next[1] - previous[1]]) {
      let value = delta < 0 ? ~(delta << 1) : delta << 1
      while (value >= 0x20) {
        out += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
        value >>= 5
      }
      out += String.fromCharCode(value + 63)
    }
    previous = next
  }
  return out
}

/** OSRM's answer for a leg: a detour through a point beside the straight line, so a routed leg is told apart from a straight one. */
function route(url: URL) {
  const [a, b] = decodeURIComponent(url.pathname.split('/').pop()!)
    .split(';')
    .map((p) => p.split(',').map(Number) as LngLat)
  const middle: LngLat = [(a[0] + b[0]) / 2 + 0.004, (a[1] + b[1]) / 2 + 0.004]
  return { code: 'Ok', routes: [{ geometry: encodePolyline6([a, middle, b]) }] }
}

/** TopPlusOpen has data to z13 everywhere and answers higher zooms with transparent tiles, as it does outside Europe. */
function tile(url: URL): Buffer {
  const zoom = url.pathname.match(/\/WEBMERCATOR\/(\d+)\//)?.[1]
  return zoom !== undefined && Number(zoom) > 13 ? EMPTY_TILE : TILE
}

async function answer(request: Route, requests: string[], places: Record<string, Place[]>): Promise<void> {
  const url = new URL(request.request().url())
  requests.push(url.href)
  if (url.hostname === 'routing.openstreetmap.de') return request.fulfill({ headers: CORS, json: route(url) })
  if (url.hostname === 'nominatim.openstreetmap.org') {
    return request.fulfill({ headers: CORS, json: places[url.searchParams.get('q') ?? ''] ?? [] })
  }
  if (url.pathname.includes('/styles/')) return request.fulfill({ headers: CORS, json: STYLE })
  return request.fulfill({ headers: CORS, contentType: 'image/png', body: tile(url) })
}

interface Fixtures {
  /** Every request the app made beyond its own origin, in order. */
  requests: string[]
  /** What the mocked place search finds, by query. */
  places: Record<string, Place[]>
  /** Whether the app is opened as on a first visit, which shows the About dialog. */
  firstVisit: boolean
}

/**
 * The app with every outside service mocked: map tiles, base map styles, routing and
 * place search. A test fails on any error thrown in the page.
 */
export const test = base.extend<Fixtures>({
  firstVisit: [false, { option: true }],
  requests: async ({}, use) => use([]),
  places: async ({}, use) => use({}),
  page: async ({ page, requests, places, firstVisit }, use) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    if (!firstVisit) await page.addInitScript(() => localStorage.setItem('mappic.help.about', 'shown'))
    await page.route((url) => url.hostname !== 'localhost', (request) => answer(request, requests, places))
    await use(page)
    expect(errors, 'errors thrown in the page').toEqual([])
  },
})

/** Opens the app, on a stored project made of `project` over an empty one, and waits for its map. */
export async function openApp(page: Page, project?: Partial<Project>): Promise<void> {
  if (project) {
    // A page of the app's origin that does not run the app, so nothing overwrites the project.
    await page.goto('/licenses.txt')
    await page.evaluate(
      (json) =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('mappic')
          open.onupgradeneeded = () => open.result.createObjectStore('data')
          open.onerror = () => reject(open.error)
          open.onsuccess = () => {
            const write = open.result.transaction('data', 'readwrite')
            write.objectStore('data').put(json, 'project')
            write.oncomplete = () => {
              open.result.close()
              resolve()
            }
          }
        }),
      JSON.stringify({ ...emptyProject(), ...project }),
    )
  }
  await page.goto('/')
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible()
}

/** The project as the app last stored it. */
export function storedProject(page: Page): Promise<Project> {
  return page.evaluate(
    () =>
      new Promise<Project>((resolve, reject) => {
        const open = indexedDB.open('mappic')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const read = open.result.transaction('data').objectStore('data').get('project')
          read.onsuccess = () => {
            open.result.close()
            resolve(JSON.parse(read.result as string) as Project)
          }
        }
      }),
  )
}

/** Adds an image as a new layer, as from the file picker. */
export async function addImage(page: Page, name = 'tour.png', width = 800, height = 600): Promise<void> {
  await page.locator('input[type=file][accept^="image"]').setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: solidPng(width, height, [250, 246, 235, 255]),
  })
  await expect.poll(async () => (await storedProject(page)).layers.length).toBeGreaterThan(0)
}

/** A point on the map canvas, as fractions of its width and height from its top left. */
export async function onMap(page: Page, fx: number, fy: number): Promise<[number, number]> {
  const box = (await page.locator('.maplibregl-canvas').boundingBox())!
  return [box.x + box.width * fx, box.y + box.height * fy]
}

/** The centre of an element on the page. */
export async function centreOf(page: Page, selector: string, index = 0): Promise<[number, number]> {
  const box = (await page.locator(selector).nth(index).boundingBox())!
  return [box.x + box.width / 2, box.y + box.height / 2]
}
