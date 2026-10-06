import type { LngLat } from './types.ts'

/** West, south, east and north edge in degrees. */
export type Bounds = [west: number, south: number, east: number, north: number]

/** The bounds of a set of points; undefined without points. */
export function boundsOf(points: readonly LngLat[]): Bounds | undefined {
  if (points.length === 0) return undefined
  const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [lng, lat] of points) {
    bounds[0] = Math.min(bounds[0], lng)
    bounds[1] = Math.min(bounds[1], lat)
    bounds[2] = Math.max(bounds[2], lng)
    bounds[3] = Math.max(bounds[3], lat)
  }
  return bounds
}
