import { describe, expect, it } from 'vitest'
import { isOpaque } from './tileGaps.ts'

const tile = (alpha: number) => new Uint8ClampedArray(256 * 256 * 4).map((_, i) => (i % 4 === 3 ? alpha : 128))

describe('isOpaque', () => {
  it('holds for a tile with data, opaque everywhere', () => {
    expect(isOpaque(tile(255))).toBe(true)
  })

  it('fails for an empty tile, transparent everywhere', () => {
    expect(isOpaque(tile(0))).toBe(false)
  })

  it('fails for a tile on the edge of the coverage, with a single pixel not quite opaque', () => {
    const pixels = tile(255)
    pixels[(256 * 255 + 255) * 4 + 3] = 254
    expect(isOpaque(pixels)).toBe(false)
  })

  it('fails for a tile that is translucent all over, as open ocean is at some zooms', () => {
    expect(isOpaque(tile(200))).toBe(false)
  })
})
