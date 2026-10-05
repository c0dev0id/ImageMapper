import type { LngLat } from '../geo/types.ts'
import { routeLegs } from '../routing/legs.ts'
import type { Route } from '../state/schema.ts'

export interface Track {
  name: string
  points: LngLat[]
}

const ENTITIES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => ENTITIES[c])
}

/** GPX requires -180 <= lon < 180. */
function wrapLongitude(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

/** A GPX 1.1 document with one track (and one segment) per entry. */
export function toGpx(name: string, tracks: readonly Track[], time: Date): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="mappic" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    '  <metadata>',
    `    <name>${escapeXml(name)}</name>`,
    `    <time>${time.toISOString()}</time>`,
    '  </metadata>',
  ]
  for (const track of tracks) {
    lines.push('  <trk>', `    <name>${escapeXml(track.name)}</name>`, '    <trkseg>')
    for (const [lng, lat] of track.points) {
      lines.push(`      <trkpt lat="${lat.toFixed(6)}" lon="${wrapLongitude(lng).toFixed(6)}"/>`)
    }
    lines.push('    </trkseg>', '  </trk>')
  }
  lines.push('</gpx>', '')
  return lines.join('\n')
}

/**
 * The points of a route: routed legs in order, unrouted legs as the straight line shown
 * on the map, with the shared point between consecutive legs only once.
 */
export function routePoints(route: Route, decode: (geometry: string) => LngLat[]): LngLat[] {
  const points: LngLat[] = []
  for (const leg of routeLegs(route)) {
    const geometry = route.legs[leg.key]
    for (const p of geometry ? decode(geometry) : [leg.from, leg.to]) {
      const last = points.at(-1)
      if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push([p[0], p[1]])
    }
  }
  return points
}

/** Tracks for every route with at least two waypoints. */
export function routeTracks(routes: readonly Route[], decode: (geometry: string) => LngLat[]): Track[] {
  return routes.filter((r) => r.waypoints.length >= 2).map((r) => ({ name: r.name, points: routePoints(r, decode) }))
}
