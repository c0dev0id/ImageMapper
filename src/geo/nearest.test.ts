import { describe, expect, it } from 'vitest'
import { closestOnSegment, nearestLine } from './nearest.ts'

describe('closestOnSegment', () => {
  it('projects onto the segment and stops at its ends', () => {
    expect(closestOnSegment([5, 3], [0, 0], [10, 0])).toEqual([5, 0])
    expect(closestOnSegment([-4, 2], [0, 0], [10, 0])).toEqual([0, 0])
    expect(closestOnSegment([14, -1], [0, 0], [10, 0])).toEqual([10, 0])
    expect(closestOnSegment([3, 4], [1, 1], [1, 1])).toEqual([1, 1])
  })
})

describe('nearestLine', () => {
  it('finds the closest polyline and the point on it', () => {
    const lines = [
      [
        [0, 0],
        [10, 0],
      ],
      [
        [0, 10],
        [10, 10],
        [10, 20],
      ],
    ] as const
    expect(nearestLine(lines, [4, 2])).toEqual({ index: 0, distance: 2, point: [4, 0] })
    expect(nearestLine(lines, [13, 15])).toEqual({ index: 1, distance: 3, point: [10, 15] })
  })

  it('handles single points and no lines', () => {
    expect(nearestLine([[[3, 4]]], [0, 0])).toEqual({ index: 0, distance: 5, point: [3, 4] })
    expect(nearestLine([], [0, 0])).toBeUndefined()
  })
})
