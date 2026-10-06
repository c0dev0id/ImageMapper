import { describe, expect, it } from 'vitest'
import { boundsOf } from './bounds.ts'

describe('boundsOf', () => {
  it('spans all points', () => {
    expect(
      boundsOf([
        [11.5, 48.2],
        [11.7, 48.1],
        [11.6, 48.3],
      ]),
    ).toEqual([11.5, 48.1, 11.7, 48.3])
  })

  it('is a point for one point and undefined for none', () => {
    expect(boundsOf([[11.5, 48.1]])).toEqual([11.5, 48.1, 11.5, 48.1])
    expect(boundsOf([])).toBeUndefined()
  })
})
