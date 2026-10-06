import { fromMercator, toMercator } from './mercator.ts'
import type { Merc, Pair, Px } from './types.ts'

export interface Similarity {
  /** Rotation around the pivot in radians; positive turns clockwise on screen (Mercator y points down). */
  angle?: number
  /** Uniform scale around the pivot. */
  scale?: number
  pivot?: Merc
  /** Translation in Mercator units, applied after rotating and scaling. */
  translate?: Merc
}

/**
 * Moves, rotates and scales the map side of placement pairs in Web Mercator. The thin
 * plate spline is linear in its targets, so the warped image (bends included) follows
 * as a whole.
 */
export function transformPlacement(
  pairs: readonly Pair[],
  { angle = 0, scale = 1, pivot = [0, 0], translate = [0, 0] }: Similarity,
): Pair[] {
  const cos = Math.cos(angle) * scale
  const sin = Math.sin(angle) * scale
  return pairs.map((p) => {
    const [x, y] = toMercator(p.map)
    const dx = x - pivot[0]
    const dy = y - pivot[1]
    return {
      image: [p.image[0], p.image[1]] as Px,
      map: fromMercator([pivot[0] + cos * dx - sin * dy + translate[0], pivot[1] + sin * dx + cos * dy + translate[1]]),
    }
  })
}

/** Rotation around `pivot` that turns the direction to `from` into the direction to `to`. */
export function angleBetween(pivot: Merc, from: Merc, to: Merc): number {
  return Math.atan2(to[1] - pivot[1], to[0] - pivot[0]) - Math.atan2(from[1] - pivot[1], from[0] - pivot[0])
}

/** Scale around `pivot` that moves `from` to the distance of `to`. */
export function scaleBetween(pivot: Merc, from: Merc, to: Merc): number {
  const before = Math.hypot(from[0] - pivot[0], from[1] - pivot[1])
  return before === 0 ? 1 : Math.hypot(to[0] - pivot[0], to[1] - pivot[1]) / before
}
