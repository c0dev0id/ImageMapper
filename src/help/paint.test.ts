import { describe, expect, it } from 'vitest'
import { tinted, vivid } from './paint.ts'

describe('vivid', () => {
  it('leaves greys alone', () => {
    expect(vivid('#808080')).toBe('#808080')
    expect(vivid('#ffffff')).toBe('#ffffff')
  })

  it('moves colours away from grey, within range', () => {
    expect(vivid('#c08080')).toBe('#f27272')
    expect(vivid('#ff0000')).toBe('#ff0000')
  })
})

describe('tinted', () => {
  it('keeps the paper white and turns black ink into the tint', () => {
    expect(tinted('#fbfaf6', '#d6336c')).toBe('#ffffff')
    expect(tinted('#000000', '#d6336c')).toBe('#d6336c')
  })

  it('tints strongly coloured ink fully, even where it is light', () => {
    expect(tinted('#ffff00', '#1c7ed6')).toBe('#1c7ed6')
  })

  it('gives pale fills a pale tint', () => {
    const [, g] = tinted('#d0d0d0', '#000000').match(/[0-9a-f]{2}/g)!.map((h) => parseInt(h, 16))
    expect(g).toBeGreaterThan(200)
    expect(g).toBeLessThan(255)
  })
})
