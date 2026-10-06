import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlaceSearch, parsePlaces, searchUrl, type SearchDeps } from './nominatim.ts'

// Shape of Nominatim's jsonv2 output (see nominatim.org/release-docs/latest/api/Output/).
const london = {
  place_id: 100149,
  licence: 'Data © OpenStreetMap contributors, ODbL 1.0. https://osm.org/copyright',
  osm_type: 'node',
  osm_id: '107775',
  boundingbox: ['51.3473219', '51.6673219', '-0.2876474', '0.0323526'],
  lat: '51.5073219',
  lon: '-0.1276474',
  display_name: 'London, Greater London, England, SW1A 2DU, United Kingdom',
  category: 'place',
  type: 'city',
  place_rank: 16,
  importance: 0.9654895765402,
  addresstype: 'city',
  name: 'London',
}
const unnamed = { lat: '48.1374', lon: '11.5755', display_name: 'Marienplatz 8, München, Deutschland', name: '' }

describe('searchUrl', () => {
  it('asks for five jsonv2 results and encodes the query', () => {
    expect(searchUrl('Café Würzburg')).toBe(
      'https://nominatim.openstreetmap.org/search?q=Caf%C3%A9+W%C3%BCrzburg&format=jsonv2&limit=5',
    )
  })

  it('adds the viewbox, rounded outward, to prefer the visible area', () => {
    expect(searchUrl('Post', { viewbox: [11.123, 47.456, 11.789, 47.912] })).toContain(
      'viewbox=11.12%2C47.45%2C11.79%2C47.92',
    )
  })

  it('keeps a viewbox smaller than the rounding step a proper box', () => {
    // Nominatim answers 400 when two sides coincide.
    expect(searchUrl('Post', { viewbox: [7.8231, 50.6612, 7.8239, 50.6618] })).toContain(
      'viewbox=7.82%2C50.66%2C7.83%2C50.67',
    )
    expect(searchUrl('Post', { viewbox: [-0.1281, 51.5071, -0.1276, 51.5075] })).toContain(
      'viewbox=-0.13%2C51.50%2C-0.12%2C51.51',
    )
  })
})

describe('parsePlaces', () => {
  it('converts coordinates and the bounding box', () => {
    expect(parsePlaces([london])).toEqual([
      {
        name: 'London',
        label: 'London, Greater London, England, SW1A 2DU, United Kingdom',
        center: [-0.1276474, 51.5073219],
        bounds: [-0.2876474, 51.3473219, 0.0323526, 51.6673219],
      },
    ])
  })

  it('falls back to the first part of the label and works without a box', () => {
    expect(parsePlaces([unnamed])).toEqual([
      { name: 'Marienplatz 8', label: unnamed.display_name, center: [11.5755, 48.1374], bounds: undefined },
    ])
  })

  it('skips unusable entries and rejects non-lists', () => {
    expect(parsePlaces([{ lat: 'x', lon: '1', display_name: 'A' }, { lat: '1', lon: '1' }])).toEqual([])
    expect(() => parsePlaces({ error: 'nope' })).toThrow(/Unexpected/)
  })
})

describe('createPlaceSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
  })
  afterEach(() => vi.useRealTimers())

  function setup(status = 200) {
    const requests: { url: string; at: number }[] = []
    const deps: SearchDeps = {
      fetchFn: async (url) => {
        requests.push({ url, at: Date.now() })
        return new Response(JSON.stringify([london]), { status })
      },
      now: () => Date.now(),
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }
    return { search: createPlaceSearch(deps), requests }
  }

  it('answers repeated searches from the cache', async () => {
    const s = setup()
    await s.search('London')
    const again = await s.search('London')
    expect(again[0].name).toBe('London')
    expect(s.requests).toHaveLength(1)
  })

  it('keeps at least one second between requests', async () => {
    const s = setup()
    await s.search('London')
    vi.advanceTimersByTime(300)
    const paris = s.search('Paris')
    await vi.advanceTimersByTimeAsync(1000)
    await paris
    expect(s.requests[1].at - s.requests[0].at).toBe(1000)
  })

  it('gives overlapping searches separate slots', async () => {
    const s = setup()
    const all = Promise.all([s.search('a'), s.search('b'), s.search('c')])
    await vi.advanceTimersByTimeAsync(3000)
    await all
    expect(s.requests.map((r) => r.at - 10_000)).toEqual([0, 1000, 2000])
  })

  it('reports a busy service and other errors', async () => {
    await expect(setup(429).search('x')).rejects.toThrow(/busy/)
    await expect(setup(503).search('y')).rejects.toThrow(/status 503/)
  })

  it('says so when the service cannot be reached', async () => {
    const search = createPlaceSearch({
      fetchFn: () => Promise.reject(new TypeError('Failed to fetch')),
      now: () => Date.now(),
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    })
    await expect(search('z')).rejects.toThrow(/could not be reached/)
  })
})
