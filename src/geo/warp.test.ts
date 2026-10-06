import { describe, expect, it } from 'vitest'
import { fromMercator, mercatorPerPixel, toMercator } from './mercator.ts'
import type { LngLat, Pair, Px } from './types.ts'
import { transformPlacement } from './similarity.ts'
import { initialPlacement, placementInView, Warp } from './warp.ts'

const W = 4000
const H = 3000
const corners: Px[] = [
  [0, 0],
  [W, 0],
  [W, H],
  [0, H],
]

/** Image to map via a rotation + scale around Munich, as a plain function. */
function rotated([x, y]: Px): LngLat {
  const angle = 0.3
  const s = 2e-8
  const dx = (x - W / 2) * s
  const dy = (y - H / 2) * s
  const [cx, cy] = toMercator([11.58, 48.14])
  return fromMercator([
    cx + dx * Math.cos(angle) - dy * Math.sin(angle),
    cy + dx * Math.sin(angle) + dy * Math.cos(angle),
  ])
}

const affinePairs: Pair[] = corners.map((image) => ({ image, map: rotated(image) }))

describe('Warp', () => {
  it('maps image pixels like the affine transform it was built from', () => {
    const warp = new Warp(affinePairs, W, H)
    for (const p of [
      [10, 10],
      [1234, 2345],
      [3999, 1],
      [2000, 1500],
    ] as Px[]) {
      const [lng, lat] = warp.imageToMap(p)
      const [elng, elat] = rotated(p)
      expect(lng).toBeCloseTo(elng, 9)
      expect(lat).toBeCloseTo(elat, 9)
    }
  })

  it('inverts its own mapping inside the image', () => {
    const bent: Pair[] = [
      ...affinePairs,
      { image: [1000, 1000], map: rotated([1060, 950]) },
      { image: [3000, 2200], map: rotated([2950, 2260]) },
    ]
    const warp = new Warp(bent, W, H)
    for (const p of [
      [5, 5],
      [1000, 1000],
      [2222, 1111],
      [3990, 2990],
    ] as Px[]) {
      const back = warp.mapToImage(warp.imageToMap(p))
      expect(back).toBeDefined()
      expect(back![0]).toBeCloseTo(p[0], 4)
      expect(back![1]).toBeCloseTo(p[1], 4)
    }
  })

  it('passes through the control points of a bent warp', () => {
    const target = rotated([1060, 950])
    const warp = new Warp([...affinePairs, { image: [1000, 1000], map: target }], W, H)
    const [lng, lat] = warp.imageToMap([1000, 1000])
    // The grid is a linear approximation between vertices; sub-metre at this scale.
    expect(Math.abs(lng - target[0])).toBeLessThan(1e-5)
    expect(Math.abs(lat - target[1])).toBeLessThan(1e-5)
  })

  it('returns undefined outside the image', () => {
    const warp = new Warp(affinePairs, W, H)
    expect(warp.mapToImage(rotated([-50, 1500]))).toBeUndefined()
    expect(warp.mapToImage(rotated([2000, 3100]))).toBeUndefined()
    expect(warp.mapToImage([0, 0])).toBeUndefined()
  })

  it('reports no flipped triangles for a faithful warp', () => {
    expect(new Warp(affinePairs, W, H).countFlippedTriangles().flipped).toBe(0)
  })

  it('reports every triangle as flipped for a mirrored warp', () => {
    const mirrored = corners.map((image) => ({ image, map: rotated([W - image[0], image[1]]) }))
    const { flipped, total } = new Warp(mirrored, W, H).countFlippedTriangles()
    expect(flipped).toBe(total)
  })

  it('reports some flipped triangles for a fold', () => {
    const folded: Pair[] = [
      ...affinePairs,
      { image: [1000, 1500], map: rotated([3000, 1500]) },
      { image: [3000, 1500], map: rotated([1000, 1500]) },
    ]
    const { flipped, total } = new Warp(folded, W, H).countFlippedTriangles()
    expect(flipped).toBeGreaterThan(0)
    expect(flipped).toBeLessThan(total)
  })

  it('takes the pixel on top where the image folds over itself', () => {
    const folded: Pair[] = [
      ...affinePairs,
      { image: [1000, 1500], map: rotated([3000, 1500]) },
      { image: [3000, 1500], map: rotated([1000, 1500]) },
    ]
    const warp = new Warp(folded, W, H)
    // The middle of the fold shows three layers of the image; the renderer draws the grid
    // row by row, left to right, so the right-hand layer comes last and lies on top.
    const spot = rotated([2000, 1500])
    const [x, y] = warp.mapToImage(spot)!
    expect(x).toBeGreaterThan(2500)
    expect(y).toBeCloseTo(1500, -1)
    const [lng, lat] = warp.imageToMap([x, y])
    expect(lng).toBeCloseTo(spot[0], 9)
    expect(lat).toBeCloseTo(spot[1], 9)
  })

  it('outlines the image border as a closed ring through the corners', () => {
    const warp = new Warp(affinePairs, W, H, 8)
    const ring = warp.outline()
    expect(ring).toHaveLength(2 * (warp.cols + warp.rows) + 1)
    expect(ring.at(-1)).toEqual(ring[0])
    for (const [corner, index] of [
      [corners[0], 0],
      [corners[1], warp.cols],
      [corners[2], warp.cols + warp.rows],
      [corners[3], 2 * warp.cols + warp.rows],
    ] as const) {
      expect(ring[index][0]).toBeCloseTo(rotated(corner)[0], 9)
      expect(ring[index][1]).toBeCloseTo(rotated(corner)[1], 9)
    }
  })

  it('builds a grid proportional to the image', () => {
    const warp = new Warp(affinePairs, W, H, 64)
    expect(warp.cols).toBe(64)
    expect(warp.rows).toBe(48)
    expect(warp.indices.length).toBe(64 * 48 * 6)
  })
})

describe('initialPlacement', () => {
  it('centres the image on the view and fills the requested share of the canvas', () => {
    const center: LngLat = [11.58, 48.14]
    const pairs = initialPlacement(W, H, center, 12, 1000, 800, 0.6)
    const warp = new Warp(pairs, W, H)
    const [lng, lat] = warp.imageToMap([W / 2, H / 2])
    expect(lng).toBeCloseTo(center[0], 9)
    expect(lat).toBeCloseTo(center[1], 9)
    // Wide image: width limited by the canvas width -> 600 px on screen.
    const left = toMercator(pairs[0].map)
    const right = toMercator(pairs[1].map)
    expect((right[0] - left[0]) / mercatorPerPixel(12)).toBeCloseTo(600, 6)
    expect(right[1]).toBeCloseTo(left[1], 12)
  })
})

describe('placementInView', () => {
  it('brings a far-away image into the view at the size of a new one, keeping its rotation', () => {
    const far = initialPlacement(W, H, [2.35, 48.85], 6, 1000, 800)
    const rotated = transformPlacement(far, { angle: Math.PI / 6, pivot: new Warp(far, W, H).center })
    const before = new Warp(rotated, W, H)
    const center: LngLat = [11.58, 48.14]
    const after = new Warp(placementInView(rotated, before, center, 13, 1000, 800), W, H)

    const [lng, lat] = after.imageToMap([W / 2, H / 2])
    expect(lng).toBeCloseTo(center[0], 9)
    expect(lat).toBeCloseTo(center[1], 9)
    const [minX, minY, maxX, maxY] = after.bounds
    const perPixel = mercatorPerPixel(13)
    expect(Math.max((maxX - minX) / perPixel / 1000, (maxY - minY) / perPixel / 800)).toBeCloseTo(0.6, 9)
    const topEdge = (w: Warp) => {
      const [ax, ay] = toMercator(w.imageToMap([0, 0]))
      const [bx, by] = toMercator(w.imageToMap([W, 0]))
      return Math.atan2(by - ay, bx - ax)
    }
    expect(topEdge(after)).toBeCloseTo(topEdge(before), 9)
  })
})
