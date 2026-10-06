import type { Map as MapLibreMap } from 'maplibre-gl'
import { nearestLine, type XY } from '../geo/nearest.ts'
import { roundLngLat, routeLegs } from '../routing/legs.ts'
import { decodePolyline } from '../routing/polyline.ts'
import { insertPoint, routeById } from '../state/project.ts'

/**
 * Inserts a point into the route where a tap hits its line (within `tolerance` CSS
 * pixels): on the nearest leg, at the closest place on the line, so the route keeps its
 * shape until the point is moved. Returns whether a point was inserted.
 */
export function insertPointOnLine(map: MapLibreMap, routeId: string, tap: XY, tolerance: number): boolean {
  const route = routeById(routeId)
  if (!route) return false
  const lines = routeLegs(route).map((leg) => {
    const geometry = route.legs[leg.key]
    return (geometry ? decodePolyline(geometry) : [leg.from, leg.to]).map((c): XY => {
      const { x, y } = map.project(c)
      return [x, y]
    })
  })
  const hit = nearestLine(lines, tap)
  if (!hit || hit.distance > tolerance) return false
  const { lng, lat } = map.unproject([hit.point[0], hit.point[1]]).wrap()
  insertPoint(routeId, hit.index + 1, roundLngLat([lng, lat]))
  return true
}
