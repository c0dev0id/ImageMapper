import { toMercator } from '../geo/mercator.ts'
import { checkControlPoints } from '../geo/tps.ts'
import type { LngLat, Pair, Px } from '../geo/types.ts'
import { Warp } from '../geo/warp.ts'
import type { Gcp, Side } from '../state/schema.ts'

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits

/** An image point at the precision of point pairs: 2 decimals of a pixel. */
export function roundImagePoint([x, y]: Px): Px {
  return [round(x, 2), round(y, 2)]
}

/** A map point at the precision of point pairs: 7 decimals of a degree, about 1 cm. */
export function roundMapPoint([lng, lat]: LngLat): LngLat {
  return [round(lng, 7), round(lat, 7)]
}

/** One side of one ground control point. */
export interface SideRef {
  gcpId: string
  side: Side
}

/** An edit of an existing point: set or replace one of its sides, or remove the whole pair. */
export type PointEdit = { kind: 'match'; side: Side; gcpId: string } | { kind: 'remove'; gcpId: string }

/** What a menu entry does: start a new pair (its image point first), or edit a point. */
export type GcpAction = { kind: 'pin' } | PointEdit

export interface MenuEntry {
  label: string
  action: GcpAction
  enabled: boolean
}

export interface MenuInput {
  /** GCPs of the active layer; undefined when there is no active layer. */
  gcps: readonly Gcp[] | undefined
  /** The selected side, if it belongs to the active layer. */
  selected: SideRef | undefined
  /** The GCP whose ring or dot is under the click, if any. */
  hit: string | undefined
  /** Whether the click lies on the active, visible image. */
  onImage: boolean
}

/**
 * Context menu entries for a right-click in georeferencing mode. A new pair always starts
 * with its image point, at the click; its place on the map is the next tap. While one side
 * of a point is selected, the menu matches it on the other side instead, which sets (or
 * replaces) that side at the click. A ring or dot under the click offers to remove its pair,
 * named by its number: both sides go together.
 */
export function gcpMenu({ gcps, selected, hit, onImage }: MenuInput): MenuEntry[] {
  const hasLayer = gcps !== undefined
  const sel = selected && gcps?.some((g) => g.id === selected.gcpId) ? selected : undefined
  const entries: MenuEntry[] = !sel
    ? [{ label: 'Pin point on image', action: { kind: 'pin' }, enabled: hasLayer && onImage }]
    : sel.side === 'map'
      ? [{ label: 'Match point on image', action: { kind: 'match', side: 'image', gcpId: sel.gcpId }, enabled: onImage }]
      : [{ label: 'Match point on map', action: { kind: 'match', side: 'map', gcpId: sel.gcpId }, enabled: true }]
  if (hit && gcps) {
    entries.push({
      label: `Remove point pair ${gcpNumber(gcps, hit)}`,
      action: { kind: 'remove', gcpId: hit },
      enabled: true,
    })
  }
  return entries
}

export interface ActionResult {
  gcps: Gcp[]
  selected: SideRef | undefined
}

/**
 * Applies an edit of an existing point. `at` is the clicked position: map coordinates and,
 * when the click is on the image, the image pixel there.
 */
export function applyGcpAction(gcps: readonly Gcp[], action: PointEdit, at: { image?: Px; map: LngLat }): ActionResult {
  switch (action.kind) {
    case 'match': {
      const value = action.side === 'image' ? at.image : at.map
      if (!value) return { gcps: [...gcps], selected: undefined }
      return {
        gcps: gcps.map((g) => (g.id === action.gcpId ? { ...g, [action.side]: value } : g)),
        selected: undefined,
      }
    }
    case 'remove':
      return { gcps: gcps.filter((g) => g.id !== action.gcpId), selected: undefined }
  }
}

/** Moves one existing side of a GCP, as when its marker is dragged; the other side stays. */
export function moveGcpSide(gcps: readonly Gcp[], gcpId: string, side: Side, value: Px | LngLat): Gcp[] {
  return gcps.map((g) => (g.id === gcpId && g[side] ? { ...g, [side]: value } : g))
}

/** The GCP whose marker (ring or dot) is nearest to a click, if one lies within `radius` CSS pixels. */
export function hitTest(
  markers: readonly { gcpId: string; x: number; y: number }[],
  x: number,
  y: number,
  radius = 10,
): string | undefined {
  let nearest: { gcpId: string; distance: number } | undefined
  for (const m of markers) {
    const distance = Math.hypot(m.x - x, m.y - y)
    if (distance <= radius && (!nearest || distance < nearest.distance)) nearest = { gcpId: m.gcpId, distance }
  }
  return nearest?.gcpId
}

/** Number shown on a GCP's markers (1-based position in the layer). */
export function gcpNumber(gcps: readonly Gcp[], id: string): number {
  return gcps.findIndex((g) => g.id === id) + 1
}

export function countPairs(gcps: readonly Gcp[]): { complete: number; unmatched: number } {
  const complete = gcps.filter((g) => g.image && g.map).length
  return { complete, unmatched: gcps.length - complete }
}

export type SkewResult = { ok: true; pairs: Pair[]; warning?: string } | { ok: false; error: string }

/** Checks the complete pairs of a layer and returns them as the new placement. */
export function prepareSkew(gcps: readonly Gcp[], width: number, height: number): SkewResult {
  const complete = gcps.filter((g): g is Gcp & Pair => !!(g.image && g.map))
  const pairs: Pair[] = complete.map((g) => ({ image: [...g.image], map: [...g.map] }))
  const labels = complete.map((g) => String(gcpNumber(gcps, g.id)))
  const problem = checkControlPoints(
    pairs.map((p) => p.image),
    pairs.map((p) => toMercator(p.map)),
    labels,
  )
  if (problem) return { ok: false, error: problem }

  let warp: Warp
  try {
    warp = new Warp(pairs, width, height)
  } catch {
    return { ok: false, error: 'The points cannot be fitted. Check for points placed at the same spot.' }
  }
  const { flipped, total } = warp.countFlippedTriangles()
  if (flipped === total) {
    return {
      ok: false,
      error: 'The pairs describe a mirrored image. Check that each image point matches the right map point.',
    }
  }
  if (flipped > 0) {
    return { ok: true, pairs, warning: 'The image folds over itself somewhere. A pair is probably wrong.' }
  }
  return { ok: true, pairs }
}
