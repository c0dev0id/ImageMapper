/** Longitude and latitude in degrees. */
export type LngLat = [number, number]

/** Image pixel coordinates: x to the right, y down, origin at the top-left corner. */
export type Px = [number, number]

/** Normalised Web Mercator coordinates: 0..1 on both axes, y down (north at 0). */
export type Merc = [number, number]

/** A complete ground control point pair: the same feature on the image and on the map. */
export interface Pair {
  image: Px
  map: LngLat
}
