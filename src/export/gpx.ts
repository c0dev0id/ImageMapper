import type { LngLat } from '../geo/types.ts'
import { routePoints } from '../routing/legs.ts'
import type { Route, Waypoint } from '../state/schema.ts'

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

const coordinates = ([lng, lat]: LngLat) => `lat="${lat.toFixed(6)}" lon="${wrapLongitude(lng).toFixed(6)}"`

/** A GPX 1.1 document with the waypoints first, then one track (and segment) per entry. */
export function toGpx(name: string, waypoints: readonly Waypoint[], tracks: readonly Track[], time: Date): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="mappic" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    '  <metadata>',
    `    <name>${escapeXml(name)}</name>`,
    `    <time>${time.toISOString()}</time>`,
    '  </metadata>',
  ]
  for (const point of waypoints) {
    lines.push(`  <wpt ${coordinates(point.lngLat)}>`, `    <name>${escapeXml(point.name)}</name>`)
    if (point.description) lines.push(`    <desc>${escapeXml(point.description)}</desc>`)
    lines.push('  </wpt>')
  }
  for (const track of tracks) {
    lines.push('  <trk>', `    <name>${escapeXml(track.name)}</name>`, '    <trkseg>')
    for (const point of track.points) lines.push(`      <trkpt ${coordinates(point)}/>`)
    lines.push('    </trkseg>', '  </trk>')
  }
  lines.push('</gpx>', '')
  return lines.join('\n')
}

/** Tracks for every route with at least two points. */
export function routeTracks(routes: readonly Route[], decode: (geometry: string) => LngLat[]): Track[] {
  return routes.filter((r) => r.points.length >= 2).map((r) => ({ name: r.name, points: routePoints(r, decode) }))
}
