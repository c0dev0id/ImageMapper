import { describe, expect, it } from 'vitest'
import { fitScale, fitSimilarity, placementOf, toImage, toMap, type Fit } from './fit.ts'
import { toMercator } from '../geo/mercator.ts'
import type { Merc, Px } from '../geo/types.ts'

// 10° clockwise, 2e-7 Mercator units per pixel, somewhere in Germany.
const angle = (10 * Math.PI) / 180
const truth: Fit = { c: 2e-7 * Math.cos(angle), s: 2e-7 * Math.sin(angle), tx: 0.53, ty: 0.34 }
const points: Px[] = [
  [100, 120],
  [900, 80],
  [700, 650],
  [150, 600],
]

describe('fitSimilarity', () => {
  it('is exact for two points', () => {
    const fit = fitSimilarity(points.slice(0, 2).map((image) => ({ image, map: toMap(truth, image) })))!
    expect(fit.c).toBeCloseTo(truth.c, 15)
    expect(fit.s).toBeCloseTo(truth.s, 15)
    expect(fitScale(fit)).toBeCloseTo(2e-7, 15)
  })

  it('averages out noise over more points', () => {
    const noise: Merc[] = [
      [3e-6, -2e-6],
      [-2e-6, 1e-6],
      [1e-6, 2e-6],
      [-2e-6, -1e-6],
    ]
    const fit = fitSimilarity(
      points.map((image, i) => {
        const [x, y] = toMap(truth, image)
        return { image, map: [x + noise[i][0], y + noise[i][1]] as Merc }
      }),
    )!
    // Within a few pixels of the truth over the whole image.
    for (const p of points) {
      const [x, y] = toImage(fit, toMap(truth, p))
      expect(Math.hypot(x - p[0], y - p[1])).toBeLessThan(15)
    }
  })

  it('needs two distinct image points', () => {
    expect(fitSimilarity([{ image: [1, 1], map: [0.5, 0.5] }])).toBeUndefined()
    expect(
      fitSimilarity([
        { image: [1, 1], map: [0.5, 0.5] },
        { image: [1, 1], map: [0.6, 0.5] },
      ]),
    ).toBeUndefined()
  })
})

describe('toImage', () => {
  it('inverts toMap', () => {
    const [x, y] = toImage(truth, toMap(truth, [321, 654]))
    expect(x).toBeCloseTo(321, 6)
    expect(y).toBeCloseTo(654, 6)
  })
})

describe('placementOf', () => {
  it('puts the image corners where the fit maps them', () => {
    const pairs = placementOf(truth, 1000, 700)
    expect(pairs.map((p) => p.image)).toEqual([
      [0, 0],
      [1000, 0],
      [1000, 700],
      [0, 700],
    ])
    const [x, y] = toMercator(pairs[2].map)
    const [ex, ey] = toMap(truth, [1000, 700])
    expect(x).toBeCloseTo(ex, 12)
    expect(y).toBeCloseTo(ey, 12)
  })
})
