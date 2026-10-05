import { describe, expect, it } from 'vitest'
import { checkControlPoints, fitThinPlateSpline, type Vec2 } from './tps.ts'

const affine = ([x, y]: Vec2): Vec2 => [0.3 + 0.002 * x - 0.0005 * y, 0.7 + 0.0004 * x + 0.0015 * y]
const bend = ([x, y]: Vec2): Vec2 => [x + 0.0004 * y * y, y + 30 * Math.sin(x / 200)]

describe('fitThinPlateSpline', () => {
  it('passes exactly through every control point', () => {
    const src: Vec2[] = [
      [0, 0],
      [1000, 20],
      [980, 760],
      [15, 800],
      [500, 400],
      [250, 620],
      [760, 210],
    ]
    const dst = src.map(bend)
    const f = fitThinPlateSpline(src, dst)
    src.forEach((p, i) => {
      const [x, y] = f(p)
      expect(x).toBeCloseTo(dst[i][0], 6)
      expect(y).toBeCloseTo(dst[i][1], 6)
    })
  })

  it('is the affine transform with exactly three pairs', () => {
    const src: Vec2[] = [
      [10, 10],
      [900, 50],
      [300, 700],
    ]
    const f = fitThinPlateSpline(src, src.map(affine))
    for (const p of [
      [500, 500],
      [-200, 1300],
      [2000, -100],
    ] as Vec2[]) {
      const [x, y] = f(p)
      const [ex, ey] = affine(p)
      expect(x).toBeCloseTo(ex, 10)
      expect(y).toBeCloseTo(ey, 10)
    }
  })

  it('reproduces an affine transform given by four rectangle corners', () => {
    const src: Vec2[] = [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ]
    const f = fitThinPlateSpline(src, src.map(affine))
    const [x, y] = f([1234, 2345])
    const [ex, ey] = affine([1234, 2345])
    expect(x).toBeCloseTo(ex, 10)
    expect(y).toBeCloseTo(ey, 10)
  })

  it('works at Mercator scale without losing precision', () => {
    // A 2 km wide image near Munich: Mercator differences around 5e-5.
    const src: Vec2[] = [
      [0, 0],
      [3000, 0],
      [3000, 2000],
      [0, 2000],
      [1500, 900],
    ]
    const toMerc = ([x, y]: Vec2): Vec2 => [0.5321 + x * 1.7e-8, 0.3477 + y * 1.7e-8 + x * 1e-10]
    const dst = src.map(toMerc)
    dst[4] = [dst[4][0] + 2e-7, dst[4][1] - 1e-7]
    const f = fitThinPlateSpline(src, dst)
    const [x, y] = f(src[4])
    expect(Math.abs(x - dst[4][0])).toBeLessThan(1e-12)
    expect(Math.abs(y - dst[4][1])).toBeLessThan(1e-12)
  })

  it('rejects fewer than three pairs', () => {
    expect(() =>
      fitThinPlateSpline(
        [
          [0, 0],
          [1, 1],
        ],
        [
          [0, 0],
          [1, 1],
        ],
      ),
    ).toThrow()
  })

  it('rejects collinear source points', () => {
    const src: Vec2[] = [
      [0, 0],
      [100, 100],
      [200, 200],
    ]
    expect(() => fitThinPlateSpline(src, src.map(affine))).toThrow()
  })
})

describe('checkControlPoints', () => {
  const labels = ['1', '2', '3', '4']
  const dst: Vec2[] = [
    [0.1, 0.1],
    [0.2, 0.1],
    [0.2, 0.2],
    [0.1, 0.2],
  ]

  it('accepts a usable configuration', () => {
    const src: Vec2[] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ]
    expect(checkControlPoints(src, dst, labels)).toBeUndefined()
  })

  it('needs three pairs', () => {
    expect(checkControlPoints([[0, 0]], [[0, 0]], labels)).toMatch(/At least 3/)
  })

  it('names duplicate image points', () => {
    const src: Vec2[] = [
      [0, 0],
      [100, 0],
      [100.4, 0.3],
      [0, 100],
    ]
    expect(checkControlPoints(src, dst, labels)).toBe('Image points 2 and 3 are at the same spot.')
  })

  it('detects (almost) collinear image points', () => {
    const src: Vec2[] = [
      [0, 0],
      [100, 0.05],
      [200, 0],
      [300, 0.02],
    ]
    expect(checkControlPoints(src, dst, labels)).toMatch(/one line/)
  })

  it('detects map points that all coincide', () => {
    const src: Vec2[] = [
      [0, 0],
      [100, 0],
      [0, 100],
    ]
    const same: Vec2[] = [
      [0.1, 0.1],
      [0.1, 0.1],
      [0.1, 0.1],
    ]
    expect(checkControlPoints(src, same, labels)).toMatch(/same spot/)
  })
})
