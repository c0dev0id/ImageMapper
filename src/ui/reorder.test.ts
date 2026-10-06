import { describe, expect, it } from 'vitest'
import { reorderTarget } from './reorder.ts'

describe('reorderTarget', () => {
  const mids = [10, 30, 50]

  it('moves an item down past the middles it crosses', () => {
    expect(reorderTarget(mids, 0, 40)).toBe(1)
    expect(reorderTarget(mids, 0, 60)).toBe(2)
  })

  it('moves an item up', () => {
    expect(reorderTarget(mids, 2, 5)).toBe(0)
    expect(reorderTarget(mids, 2, 20)).toBe(1)
  })

  it('keeps the place while the pointer stays between the neighbours', () => {
    expect(reorderTarget(mids, 1, 25)).toBe(1)
    expect(reorderTarget(mids, 1, 45)).toBe(1)
  })
})
