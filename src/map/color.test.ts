import { describe, expect, it } from 'vitest'
import { hexToRgb } from './color.ts'

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
