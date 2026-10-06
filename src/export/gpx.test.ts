import { describe, expect, it } from 'vitest'
import type { LngLat } from '../geo/types.ts'
import type { Route } from '../state/schema.ts'
import { namedPoints, routeTracks, toGpx } from './gpx.ts'

const time = new Date('2026-10-05T12:00:00Z')

describe('toGpx', () => {
  it('writes one track with a segment per route', () => {
    const gpx = toGpx('Alps', [], [
      { name: 'Day 1', points: [[11.5, 48.1], [11.6, 48.2]] },
      { name: 'Day 2', points: [[12, 47]] },
    ], time)
    expect(gpx).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="mappic" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Alps</name>
    <time>2026-10-05T12:00:00.000Z</time>
  </metadata>
  <trk>
    <name>Day 1</name>
    <trkseg>
      <trkpt lat="48.100000" lon="11.500000"/>
      <trkpt lat="48.200000" lon="11.600000"/>
    </trkseg>
  </trk>
  <trk>
    <name>Day 2</name>
    <trkseg>
      <trkpt lat="47.000000" lon="12.000000"/>
    </trkseg>
  </trk>
</gpx>
`)
  })

  it('writes waypoints before the tracks', () => {
    const gpx = toGpx('Alps', [{ name: 'Café', lngLat: [11.5, 48.1] }], [{ name: 'Day 1', points: [[11.5, 48.1]] }], time)
    expect(gpx).toContain(`  </metadata>
  <wpt lat="48.100000" lon="11.500000">
    <name>Café</name>
  </wpt>
  <trk>`)
  })

  it('escapes names', () => {
    const gpx = toGpx('A & B', [{ name: 'Tom & Jerry', lngLat: [0, 0] }], [{ name: '<Pass> "Höhe"', points: [] }], time)
    expect(gpx).toContain('<name>A &amp; B</name>')
    expect(gpx).toContain('<name>Tom &amp; Jerry</name>')
    expect(gpx).toContain('<name>&lt;Pass&gt; &quot;Höhe&quot;</name>')
  })

  it('keeps longitudes in [-180, 180)', () => {
    const gpx = toGpx('x', [{ name: 'w', lngLat: [190, 0] }], [{ name: 't', points: [[180, 0], [-190, 0], [359, 0]] }], time)
    expect(gpx).toContain('<wpt lat="0.000000" lon="-170.000000">')
    expect(gpx).toContain('lon="-180.000000"')
    expect(gpx).toContain('lon="170.000000"')
    expect(gpx).toContain('lon="-1.000000"')
  })
})

const decode = (geometry: string): LngLat[] => JSON.parse(geometry)

const route: Route = {
  id: 'r',
  name: 'Tour',
  profile: 'car',
  color: '#000',
  waypoints: [
    { id: 'a', lngLat: [1, 1] },
    { id: 'b', lngLat: [2, 2] },
    { id: 'c', lngLat: [3, 3] },
  ],
  legs: { 'car/1,1;2,2': '[[1,1],[1.5,1.2],[2,2]]', 'car/2,2;3,3': '[[2,2],[2.5,2.8],[3,3]]' },
}

describe('namedPoints', () => {
  it('collects the named points of all routes in order', () => {
    const named = { ...route, waypoints: [route.waypoints[0], { ...route.waypoints[1], name: 'B' }, route.waypoints[2]] }
    const other = { ...route, id: 'o', waypoints: [{ id: 'x', lngLat: [5, 5] as LngLat, name: 'X' }], legs: {} }
    expect(namedPoints([named, route, other])).toEqual([
      { name: 'B', lngLat: [2, 2] },
      { name: 'X', lngLat: [5, 5] },
    ])
  })
})

describe('routeTracks', () => {
  it('skips routes with fewer than two waypoints', () => {
    const single = { ...route, id: 's', name: 'Single', waypoints: [route.waypoints[0]], legs: {} }
    expect(routeTracks([route, single], decode).map((t) => t.name)).toEqual(['Tour'])
  })
})
