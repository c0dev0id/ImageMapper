import { describe, expect, it } from 'vitest'
import { fromMercator, toMercator } from '../geo/mercator.ts'
import type { LngLat, Px } from '../geo/types.ts'
import type { Gcp } from '../state/schema.ts'
import {
  gcpMenu,
  hitTest,
  moveGcpSide,
  prepareSkew,
  roundImagePoint,
  roundMapPoint,
  type MenuEntry,
} from './gcps.ts'

const labels = (entries: MenuEntry[]) => entries.map((e) => `${e.label}${e.enabled ? '' : ' (disabled)'}`)

const first: Gcp = { id: 'a', image: [10, 10], map: [11, 48] }
const second: Gcp = { id: 'b', image: [20, 20], map: [11.1, 48.1] }

describe('gcpMenu', () => {
  it('starts a new pair on the image', () => {
    const entries = gcpMenu({ gcps: [], hit: undefined, onImage: true })
    expect(labels(entries)).toEqual(['Pin point on image'])
    expect(entries[0].action).toEqual({ kind: 'pin' })
  })

  it('disables starting a pair when the click is not on the image', () => {
    const entries = gcpMenu({ gcps: [], hit: undefined, onImage: false })
    expect(labels(entries)).toEqual(['Pin point on image (disabled)'])
  })

  it('disables everything without an active layer', () => {
    const entries = gcpMenu({ gcps: undefined, hit: undefined, onImage: false })
    expect(labels(entries)).toEqual(['Pin point on image (disabled)'])
  })

  it('offers removing the pair under the click, named by its number', () => {
    const entries = gcpMenu({ gcps: [first, second], hit: 'b', onImage: true })
    expect(labels(entries)).toEqual(['Pin point on image', 'Remove point pair 2'])
    expect(entries[1].action).toEqual({ kind: 'remove', gcpId: 'b' })
  })

  it('offers removing beside the image too', () => {
    const entries = gcpMenu({ gcps: [first], hit: 'a', onImage: false })
    expect(labels(entries)).toEqual(['Pin point on image (disabled)', 'Remove point pair 1'])
  })
})

describe('moveGcpSide', () => {
  it('moves one side and leaves the partner and other points alone', () => {
    const gcps = [first, second]
    const moved = moveGcpSide(gcps, 'a', 'map', [11.2, 48.2])
    expect(moved[0]).toEqual({ id: 'a', image: [10, 10], map: [11.2, 48.2] })
    expect(moved[1]).toBe(second)
    expect(moveGcpSide(gcps, 'a', 'image', [12, 13])[0]).toEqual({ id: 'a', image: [12, 13], map: [11, 48] })
  })

})

describe('hitTest', () => {
  const markers = [
    { gcpId: 'a', x: 106, y: 108 },
    { gcpId: 'b', x: 103, y: 104 },
    { gcpId: 'c', x: 300, y: 300 },
  ]

  it('returns the point with the nearest marker', () => {
    expect(hitTest(markers, 100, 100)).toBe('b')
  })

  it('reaches as far as the radius and no farther', () => {
    expect(hitTest([markers[0]], 100, 100)).toBe('a')
    expect(hitTest([markers[0]], 100, 100, 9)).toBeUndefined()
  })
})

describe('prepareSkew', () => {
  const W = 1000
  const H = 800
  const center = toMercator([11.5, 48.1])
  const geo = ([x, y]: Px): LngLat => fromMercator([center[0] + (x - W / 2) * 1e-8, center[1] + (y - H / 2) * 1e-8])
  const gcp = (id: string, image: Px, map = geo(image)): Gcp => ({ id, image, map })

  it('returns the pairs as placement', () => {
    const result = prepareSkew([gcp('1', [0, 0]), gcp('2', [900, 50]), gcp('3', [400, 700])], W, H)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pairs).toHaveLength(3)
      expect(result.warning).toBeUndefined()
    }
  })

  it('needs three pairs', () => {
    const result = prepareSkew([gcp('1', [0, 0]), gcp('2', [900, 50])], W, H)
    expect(result).toEqual({ ok: false, error: 'At least 3 point pairs are needed.' })
  })

  it('names duplicate image points by their marker numbers', () => {
    const result = prepareSkew([gcp('0', [500, 500]), gcp('1', [0, 0]), gcp('2', [900, 50]), gcp('3', [900.2, 50])], W, H)
    expect(result).toEqual({ ok: false, error: 'Image points 3 and 4 are at the same spot.' })
  })

  it('rejects mirrored pairs', () => {
    const mirrored = (p: Px) => geo([W - p[0], p[1]])
    const result = prepareSkew(
      [gcp('1', [0, 0], mirrored([0, 0])), gcp('2', [900, 50], mirrored([900, 50])), gcp('3', [400, 700], mirrored([400, 700]))],
      W,
      H,
    )
    expect(result.ok).toBe(false)
  })

  it('warns about folds', () => {
    const result = prepareSkew(
      [
        gcp('1', [0, 0]),
        gcp('2', [1000, 0]),
        gcp('3', [1000, 800]),
        gcp('4', [0, 800]),
        gcp('5', [300, 400], geo([700, 400])),
        gcp('6', [700, 400], geo([300, 400])),
      ],
      W,
      H,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.warning).toMatch(/folds/)
  })
})

describe('rounding to point pair precision', () => {
  it('keeps 2 decimals of a pixel and 7 of a degree', () => {
    expect(roundImagePoint([888.123456, 271.5])).toEqual([888.12, 271.5])
    expect(roundMapPoint([7.9712345678, 50.5598765432])).toEqual([7.9712346, 50.5598765])
  })
})
