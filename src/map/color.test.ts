import { describe, expect, it } from 'vitest'
import { hexToRgb, rgbToHex } from './color.ts'

describe('hexToRgb', () => {
  it('turns #rrggbb into channels from 0 to 1', () => {
    expect(hexToRgb('#ff0080')).toEqual([1, 0, 128 / 255])
    expect(hexToRgb('#D6336C')).toEqual([214 / 255, 51 / 255, 108 / 255])
  })

  it('gives black for anything else', () => {
    expect(hexToRgb('red')).toEqual([0, 0, 0])
    expect(hexToRgb('#fff')).toEqual([0, 0, 0])
  })
})

describe('rgbToHex', () => {
  it('turns channels from 0 to 1 into #rrggbb', () => {
    expect(rgbToHex([1, 0, 128 / 255])).toBe('#ff0080')
    expect(rgbToHex(hexToRgb('#d6336c'))).toBe('#d6336c')
  })

  it('clamps channels outside 0 to 1', () => {
    expect(rgbToHex([1.4, -0.2, 0.5])).toBe('#ff0080')
  })
})
