import { NOMINATIM_URL, SEARCH_MIN_INTERVAL_MS, SEARCH_TIMEOUT_MS } from '../config.ts'
import type { LngLat } from '../geo/types.ts'

export interface Place {
  /** Short name, e.g. "Marienplatz". */
  name: string
  /** Full description, e.g. "Marienplatz, Altstadt-Lehel, München, Bayern, …". */
  label: string
  center: LngLat
  /** Extent as [west, south, east, north], if known. */
  bounds?: [number, number, number, number]
}

/** Area to prefer as [west, south, east, north]; results elsewhere are still returned. */
export type Viewbox = [number, number, number, number]

export function searchUrl(query: string, viewbox?: Viewbox): string {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5' })
  if (viewbox) params.set('viewbox', viewbox.map((v) => v.toFixed(2)).join(','))
  return `${NOMINATIM_URL}/search?${params}`
}

/** Converts Nominatim's jsonv2 results; entries without usable coordinates are skipped. */
export function parsePlaces(data: unknown): Place[] {
  if (!Array.isArray(data)) throw new Error('Unexpected answer from the search service.')
  const places: Place[] = []
  for (const item of data as Record<string, unknown>[]) {
    const lat = Number(item?.lat)
    const lon = Number(item?.lon)
    const label = typeof item?.display_name === 'string' ? item.display_name : ''
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !label) continue
    const name = (typeof item.name === 'string' && item.name) || label.split(',')[0]
    // boundingbox: [min lat, max lat, min lon, max lon] as strings.
    const box = Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : []
    const bounds: Place['bounds'] =
      box.length === 4 && box.every(Number.isFinite) ? [box[2], box[0], box[3], box[1]] : undefined
    places.push({ name, label, center: [lon, lat], bounds })
  }
  return places
}

export interface SearchDeps {
  fetchFn: (url: string, init: RequestInit) => Promise<Response>
  now: () => number
  wait: (ms: number) => Promise<void>
}

const browserDeps: SearchDeps = {
  fetchFn: (url, init) => fetch(url, init),
  now: () => Date.now(),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

/**
 * A place search that follows the Nominatim usage policy: requests are spaced at least
 * one second apart (slots are reserved, so even overlapping calls comply) and identical
 * requests are answered from a cache.
 */
export function createPlaceSearch({ fetchFn, now, wait }: SearchDeps = browserDeps) {
  const cache = new Map<string, Place[]>()
  let lastStart = -Infinity
  return async (query: string, viewbox?: Viewbox): Promise<Place[]> => {
    const url = searchUrl(query, viewbox)
    const cached = cache.get(url)
    if (cached) return cached
    const start = Math.max(now(), lastStart + SEARCH_MIN_INTERVAL_MS)
    lastStart = start
    const delay = start - now()
    if (delay > 0) await wait(delay)
    const response = await fetchFn(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) })
    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? 'The search service is busy. Try again in a moment.'
          : `The search service answered with status ${response.status}.`,
      )
    }
    const places = parsePlaces(await response.json())
    cache.set(url, places)
    return places
  }
}
