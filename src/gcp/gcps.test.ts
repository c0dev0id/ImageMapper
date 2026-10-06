import { describe, expect, it } from 'vitest'
import { fromMercator, toMercator } from '../geo/mercator.ts'
import type { LngLat, Px } from '../geo/types.ts'
import type { Gcp } from '../state/schema.ts'
import { applyGcpAction, countPairs, gcpMenu, hitTest, moveGcpSide, prepareSkew, type MenuEntry } from './gcps.ts'

const labels = (entries: MenuEntry[]) => entries.map((e) => `${e.label}${e.enabled ? '' : ' (disabled)'}`)

const paired: Gcp = { id: 'a', image: [10, 10], map: [11, 48] }
const imageOnly: Gcp = { id: 'b', image: [20, 20] }
const mapOnly: Gcp = { id: 'c', map: [11.1, 48.1] }

describe('gcpMenu', () => {
  it('offers marking on both sides without a selection', () => {
    const entries = gcpMenu({ gcps: [], selected: undefined, hits: [], onImage: true })
    expect(labels(entries)).toEqual(['Mark point on image', 'Mark point on map'])
  })

  it('disables marking on the image when the click is not on it', () => {
    const entries = gcpMenu({ gcps: [], selected: undefined, hits: [], onImage: false })
    expect(labels(entries)).toEqual(['Mark point on image (disabled)', 'Mark point on map'])
  })

  it('disables everything without an active layer', () => {
    const entries = gcpMenu({ gcps: undefined, selected: undefined, hits: [], onImage: false })
    expect(labels(entries)).toEqual(['Mark point on image (disabled)', 'Mark point on map (disabled)'])
  })

  it('offers matching on the map when an image point is selected', () => {
    const entries = gcpMenu({
      gcps: [imageOnly],
      selected: { gcpId: 'b', side: 'image' },
      hits: [],
      onImage: true,
    })
    expect(labels(entries)).toEqual(['Match point on map'])
    expect(entries[0].action).toEqual({ kind: 'match', side: 'map', gcpId: 'b' })
  })

  it('offers matching on the image when a map point is selected', () => {
    const entries = gcpMenu({ gcps: [mapOnly], selected: { gcpId: 'c', side: 'map' }, hits: [], onImage: true })
    expect(labels(entries)).toEqual(['Match point on image'])
  })

  it('offers no new point beside the image while a map point waits for its match', () => {
    const entries = gcpMenu({ gcps: [mapOnly], selected: { gcpId: 'c', side: 'map' }, hits: [], onImage: false })
    expect(labels(entries)).toEqual(['Match point on image (disabled)'])
  })

  it('keeps removing available while a point is selected', () => {
    const entries = gcpMenu({
      gcps: [paired, imageOnly],
      selected: { gcpId: 'b', side: 'image' },
      hits: [{ gcpId: 'a', side: 'map', distance: 3 }],
      onImage: true,
    })
    expect(labels(entries)).toEqual(['Match point on map', 'Remove point'])
  })

  it('also offers matching for a selected side of a complete pair', () => {
    const entries = gcpMenu({ gcps: [paired], selected: { gcpId: 'a', side: 'map' }, hits: [], onImage: true })
    expect(entries[0].action).toEqual({ kind: 'match', side: 'image', gcpId: 'a' })
  })

  it('ignores a selection that does not belong to the layer', () => {
    const entries = gcpMenu({ gcps: [paired], selected: { gcpId: 'zz', side: 'image' }, hits: [], onImage: true })
    expect(labels(entries)).toEqual(['Mark point on image', 'Mark point on map'])
  })

  it('offers removing the nearest hit point', () => {
    const entries = gcpMenu({
      gcps: [paired, imageOnly],
      selected: undefined,
      hits: [
        { gcpId: 'a', side: 'map', distance: 6 },
        { gcpId: 'b', side: 'image', distance: 2 },
      ],
      onImage: true,
    })
    expect(entries.at(-1)).toEqual({
      label: 'Remove point',
      action: { kind: 'remove', side: 'image', gcpId: 'b' },
      enabled: true,
    })
  })

  it('asks which side to remove when both sides of a pair are hit', () => {
    const entries = gcpMenu({
      gcps: [paired],
      selected: undefined,
      hits: [
        { gcpId: 'a', side: 'image', distance: 0 },
        { gcpId: 'a', side: 'map', distance: 0 },
      ],
      onImage: true,
    })
    expect(labels(entries).slice(2)).toEqual(['Remove image point', 'Remove map point'])
  })
})

describe('applyGcpAction', () => {
  const at = { image: [5, 6] as Px, map: [12, 49] as LngLat }
  const ids = () => 'new'

  it('marks a new image point and selects it', () => {
    const result = applyGcpAction([paired], { kind: 'mark', side: 'image' }, at, ids)
    expect(result.gcps).toEqual([paired, { id: 'new', image: [5, 6] }])
    expect(result.selected).toEqual({ gcpId: 'new', side: 'image' })
  })

  it('marks a new map point and selects it', () => {
    const result = applyGcpAction([], { kind: 'mark', side: 'map' }, at, ids)
    expect(result.gcps).toEqual([{ id: 'new', map: [12, 49] }])
    expect(result.selected).toEqual({ gcpId: 'new', side: 'map' })
  })

  it('matches the selected point and clears the selection', () => {
    const result = applyGcpAction([imageOnly], { kind: 'match', side: 'map', gcpId: 'b' }, at, ids)
    expect(result.gcps).toEqual([{ id: 'b', image: [20, 20], map: [12, 49] }])
    expect(result.selected).toBeUndefined()
  })

  it('replaces the partner of a complete pair when matching again', () => {
    const result = applyGcpAction([paired], { kind: 'match', side: 'image', gcpId: 'a' }, at, ids)
    expect(result.gcps).toEqual([{ id: 'a', image: [5, 6], map: [11, 48] }])
  })

  it('removes one side and selects the remaining partner', () => {
    const result = applyGcpAction([paired, imageOnly], { kind: 'remove', side: 'map', gcpId: 'a' }, at, ids)
    expect(result.gcps).toEqual([{ id: 'a', image: [10, 10] }, imageOnly])
    expect(result.gcps[0]).not.toHaveProperty('map')
    expect(result.selected).toEqual({ gcpId: 'a', side: 'image' })
  })

  it('deletes the point when its last side is removed', () => {
    const result = applyGcpAction([paired, imageOnly], { kind: 'remove', side: 'image', gcpId: 'b' }, at, ids)
    expect(result.gcps).toEqual([paired])
    expect(result.selected).toBeUndefined()
  })

  it('does not modify its input', () => {
    const gcps = [paired]
    applyGcpAction(gcps, { kind: 'remove', side: 'map', gcpId: 'a' }, at, ids)
    expect(gcps).toEqual([{ id: 'a', image: [10, 10], map: [11, 48] }])
  })
})

describe('moveGcpSide', () => {
  it('moves one side and leaves the partner and other points alone', () => {
    const gcps = [paired, imageOnly]
    const moved = moveGcpSide(gcps, 'a', 'map', [11.2, 48.2])
    expect(moved[0]).toEqual({ id: 'a', image: [10, 10], map: [11.2, 48.2] })
    expect(moved[1]).toBe(imageOnly)
    expect(moveGcpSide(gcps, 'a', 'image', [12, 13])[0]).toEqual({ id: 'a', image: [12, 13], map: [11, 48] })
  })

  it('does not add a side that is missing', () => {
    expect(moveGcpSide([imageOnly], 'b', 'map', [1, 1])).toEqual([imageOnly])
  })
})

describe('hitTest', () => {
  it('returns sides within the radius with their distance', () => {
    const hits = hitTest(
      [
        { gcpId: 'a', side: 'image', x: 100, y: 100 },
        { gcpId: 'a', side: 'map', x: 106, y: 108 },
        { gcpId: 'b', side: 'map', x: 300, y: 300 },
      ],
      100,
      100,
    )
    expect(hits).toEqual([
      { gcpId: 'a', side: 'image', distance: 0 },
      { gcpId: 'a', side: 'map', distance: 10 },
    ])
  })
})

describe('countPairs', () => {
  it('counts complete and unmatched points', () => {
    expect(countPairs([paired, imageOnly, mapOnly])).toEqual({ complete: 1, unmatched: 2 })
  })
})

describe('prepareSkew', () => {
  const W = 1000
  const H = 800
  const center = toMercator([11.5, 48.1])
  const geo = ([x, y]: Px): LngLat => fromMercator([center[0] + (x - W / 2) * 1e-8, center[1] + (y - H / 2) * 1e-8])
  const gcp = (id: string, image: Px, map = geo(image)): Gcp => ({ id, image, map })

  it('returns the complete pairs as placement and ignores unmatched points', () => {
    const result = prepareSkew([gcp('1', [0, 0]), imageOnly, gcp('2', [900, 50]), gcp('3', [400, 700])], W, H)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.pairs).toHaveLength(3)
      expect(result.warning).toBeUndefined()
    }
  })

  it('needs three pairs', () => {
    const result = prepareSkew([gcp('1', [0, 0]), gcp('2', [900, 50])], W, H)
    expect(result).toEqual({ ok: false, error: 'At least 3 complete point pairs are needed.' })
  })

  it('names duplicate image points by their marker numbers', () => {
    const result = prepareSkew([imageOnly, gcp('1', [0, 0]), gcp('2', [900, 50]), gcp('3', [900.2, 50])], W, H)
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
