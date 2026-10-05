import { describe, expect, it } from 'vitest'
import { fromMercator, mercatorPerPixel, toMercator } from './mercator.ts'

const MAX_LAT = 85.0511287798066

describe('mercator', () => {
  it('maps the origin to the centre of the world', () => {
    const [x, y] = toMercator([0, 0])
    expect(x).toBeCloseTo(0.5, 12)
    expect(y).toBeCloseTo(0.5, 12)
  })

  it('maps the corners of the Web Mercator square', () => {
    const nw = toMercator([-180, MAX_LAT])
    const se = toMercator([180, -MAX_LAT])
    expect(nw[0]).toBeCloseTo(0, 9)
    expect(nw[1]).toBeCloseTo(0, 9)
    expect(se[0]).toBeCloseTo(1, 9)
    expect(se[1]).toBeCloseTo(1, 9)
  })

  it('round-trips longitude and latitude', () => {
    for (const p of [
      [13.405, 52.52],
      [-122.42, 37.77],
      [151.21, -33.87],
      [0.001, -0.001],
    ] as [number, number][]) {
      const [lng, lat] = fromMercator(toMercator(p))
      expect(lng).toBeCloseTo(p[0], 10)
      expect(lat).toBeCloseTo(p[1], 10)
    }
  })

  it('has y growing southwards', () => {
    expect(toMercator([0, 10])[1]).toBeLessThan(toMercator([0, -10])[1])
  })

  it('computes the size of a pixel at a zoom level', () => {
    expect(mercatorPerPixel(0)).toBe(1 / 512)
    expect(mercatorPerPixel(3)).toBe(1 / 4096)
  })
})
