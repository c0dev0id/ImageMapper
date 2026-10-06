import { describe, expect, it } from 'vitest'
import { fromMercator, toMercator } from './mercator.ts'
import { angleBetween, scaleBetween, transformPlacement } from './similarity.ts'
import type { LngLat, Merc, Pair, Px } from './types.ts'
import { Warp } from './warp.ts'

const W = 1000
const H = 800
const center = toMercator([11.5, 48.1])
const geo = ([x, y]: Px): LngLat => fromMercator([center[0] + (x - W / 2) * 1e-8, center[1] + (y - H / 2) * 1e-8])
const corners: Pair[] = (
  [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ] as Px[]
).map((image) => ({ image, map: geo(image) }))

const merc = (p: LngLat): Merc => toMercator(p)
const close = (a: Merc, b: Merc) => {
  expect(a[0]).toBeCloseTo(b[0], 12)
  expect(a[1]).toBeCloseTo(b[1], 12)
}

describe('transformPlacement', () => {
  it('translates in Mercator', () => {
    const moved = transformPlacement(corners, { translate: [1e-6, -2e-6] })
    moved.forEach((p, i) => {
      const [x, y] = merc(corners[i].map)
      close(merc(p.map), [x + 1e-6, y - 2e-6])
      expect(p.image).toEqual(corners[i].image)
    })
  })

  it('rotates clockwise (on screen) and scales around the pivot', () => {
    const [x, y] = merc(corners[1].map)
    const [rx, ry] = transformPlacement([corners[1]], { angle: Math.PI / 2, scale: 2, pivot: center }).map((p) =>
      merc(p.map),
    )[0]
    // A right-pointing offset becomes a downward one, twice as long.
    close([rx, ry], [center[0] - 2 * (y - center[1]), center[1] + 2 * (x - center[0])])
  })

  it('moves a bent warp as a whole', () => {
    const bent: Pair[] = [...corners, { image: [300, 300], map: geo([340, 260]) }, { image: [700, 500], map: geo([650, 540]) }]
    const t = { angle: 0.4, scale: 1.3, pivot: center, translate: [3e-7, 1e-7] as Merc }
    const before = new Warp(bent, W, H)
    const after = new Warp(transformPlacement(bent, t), W, H)
    for (const p of [[123, 456], [300, 300], [900, 50]] as Px[]) {
      const expected = transformPlacement([{ image: p, map: before.imageToMap(p) }], t)[0].map
      close(merc(after.imageToMap(p)), merc(expected))
    }
  })
})

describe('angleBetween and scaleBetween', () => {
  it('measure rotation and scale around a pivot', () => {
    expect(angleBetween([0, 0], [1, 0], [0, 1])).toBeCloseTo(Math.PI / 2, 12)
    expect(scaleBetween([1, 1], [2, 1], [1, 4])).toBeCloseTo(3, 12)
    expect(scaleBetween([1, 1], [1, 1], [5, 5])).toBe(1)
  })
})
