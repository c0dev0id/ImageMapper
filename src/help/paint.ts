import { hexToRgb, rgbToHex } from '../map/color.ts'

// Colour changes for the help's drawings. Vivid and one colour are the formulas of `recolor`
// in map/WarpedImageLayer.ts, so that the drawings show what the map does to an image.

const luma = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Vivid: twice as far from grey. */
export function vivid(hex: string): string {
  const c = hexToRgb(hex)
  const l = luma(c)
  return rgbToHex(c.map((v) => l + (v - l) * 2))
}

/** One colour: ink, dark or strongly coloured, in the tint, the paper white. */
export function tinted(hex: string, tint: string): string {
  const c = hexToRgb(hex)
  const ink = Math.max(1 - luma(c), Math.max(...c) - Math.min(...c))
  const t = smoothstep(0.15, 0.6, ink)
  return rgbToHex(hexToRgb(tint).map((v) => 1 + (v - 1) * t))
}

/** The negative: an image on a dark background, which is what Screen is for. */
export function inverted(hex: string): string {
  return rgbToHex(hexToRgb(hex).map((v) => 1 - v))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}
