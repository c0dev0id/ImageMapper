import { fromMercator } from '../geo/mercator.ts'
import type { Merc, Pair, Px } from '../geo/types.ts'

/**
 * A similarity transform from image pixels to Web Mercator: rotation and uniform scale
 * (c, s) and translation (tx, ty), so that m = [c·x − s·y + tx, s·x + c·y + ty]. Image
 * and Mercator y both point down, so a map that is not mirrored needs no reflection.
 */
export interface Fit {
  c: number
  s: number
  tx: number
  ty: number
}

export interface Correspondence {
  image: Px
  map: Merc
}

/**
 * The least-squares similarity for two or more correspondences (exact for two);
 * undefined when all image points coincide.
 */
export function fitSimilarity(pairs: readonly Correspondence[]): Fit | undefined {
  const n = pairs.length
  if (n < 2) return undefined
  let ix = 0
  let iy = 0
  let mx = 0
  let my = 0
  for (const { image, map } of pairs) {
    ix += image[0] / n
    iy += image[1] / n
    mx += map[0] / n
    my += map[1] / n
  }
  let norm = 0
  let dot = 0
  let cross = 0
  for (const { image, map } of pairs) {
    const x = image[0] - ix
    const y = image[1] - iy
    const u = map[0] - mx
    const v = map[1] - my
    norm += x * x + y * y
    dot += x * u + y * v
    cross += x * v - y * u
  }
  if (norm === 0) return undefined
  const c = dot / norm
  const s = cross / norm
  if (c === 0 && s === 0) return undefined
  return { c, s, tx: mx - (c * ix - s * iy), ty: my - (s * ix + c * iy) }
}

export function toMap(fit: Fit, [x, y]: Px): Merc {
  return [fit.c * x - fit.s * y + fit.tx, fit.s * x + fit.c * y + fit.ty]
}

export function toImage(fit: Fit, [u, v]: Merc): Px {
  const x = u - fit.tx
  const y = v - fit.ty
  const k = fit.c * fit.c + fit.s * fit.s
  return [(fit.c * x + fit.s * y) / k, (fit.c * y - fit.s * x) / k]
}

/** Mercator units per image pixel. */
export function fitScale(fit: Fit): number {
  return Math.hypot(fit.c, fit.s)
}

/** Placement pairs for the image corners, which put the whole image where the fit says. */
export function placementOf(fit: Fit, width: number, height: number): Pair[] {
  const corners: Px[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ]
  return corners.map((image) => ({ image, map: fromMercator(toMap(fit, image)) }))
}
