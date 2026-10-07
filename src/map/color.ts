/** A #rrggbb colour as red, green and blue from 0 to 1, as shaders take it; black if malformed. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0, 0, 0]
}

/** Red, green and blue from 0 to 1 as a #rrggbb colour; channels outside are clamped. */
export function rgbToHex(rgb: readonly number[]): string {
  return `#${rgb.map((c) => Math.round(Math.min(Math.max(c, 0), 1) * 255).toString(16).padStart(2, '0')).join('')}`
}
