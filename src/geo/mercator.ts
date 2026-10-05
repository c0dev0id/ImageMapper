import type { LngLat, Merc } from './types.ts'

const DEG = Math.PI / 180

/** Converts longitude/latitude to normalised Web Mercator (same formula as MapLibre). */
export function toMercator([lng, lat]: LngLat): Merc {
  return [(180 + lng) / 360, (180 - Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2)) / DEG) / 360]
}

/** Converts normalised Web Mercator back to longitude/latitude. */
export function fromMercator([x, y]: Merc): LngLat {
  const y2 = 180 - y * 360
  return [x * 360 - 180, (360 / Math.PI) * Math.atan(Math.exp(y2 * DEG)) - 90]
}

/** Mercator units per CSS pixel at a zoom level; MapLibre's world is 512 * 2^zoom pixels wide. */
export function mercatorPerPixel(zoom: number): number {
  return 1 / (512 * 2 ** zoom)
}
