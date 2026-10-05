import { toMercator } from '../geo/mercator.ts'
import { checkControlPoints } from '../geo/tps.ts'
import type { LngLat, Pair, Px } from '../geo/types.ts'
import { Warp } from '../geo/warp.ts'
import type { Gcp, Side } from '../state/schema.ts'

/** One side of one ground control point. */
export interface SideRef {
  gcpId: string
  side: Side
}

export interface Hit extends SideRef {
  /** Screen distance from the click in CSS pixels. */
  distance: number
}

export type GcpAction =
  | { kind: 'mark'; side: Side }
  | { kind: 'match'; side: Side; gcpId: string }
  | { kind: 'remove'; side: Side; gcpId: string }

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
  hits: readonly Hit[]
  /** Whether the click lies on the active, visible image. */
  onImage: boolean
}

const other = (side: Side): Side => (side === 'image' ? 'map' : 'image')

/**
 * Context menu entries for a right-click in georeferencing mode. "Match" appears when the
 * opposite side of a GCP is selected and sets (or replaces) the side at the click.
 */
export function gcpMenu({ gcps, selected, hits, onImage }: MenuInput): MenuEntry[] {
  const hasLayer = gcps !== undefined
  const sel = selected && gcps?.some((g) => g.id === selected.gcpId) ? selected : undefined
  const entries: MenuEntry[] = [
    sel?.side === 'map'
      ? {
          label: 'Match point on image',
          action: { kind: 'match', side: 'image', gcpId: sel.gcpId },
          enabled: onImage,
        }
      : { label: 'Mark point on image', action: { kind: 'mark', side: 'image' }, enabled: hasLayer && onImage },
    sel?.side === 'image'
      ? { label: 'Match point on map', action: { kind: 'match', side: 'map', gcpId: sel.gcpId }, enabled: true }
      : { label: 'Mark point on map', action: { kind: 'mark', side: 'map' }, enabled: hasLayer },
  ]
  const nearest = [...hits].sort((a, b) => a.distance - b.distance)[0]
  if (nearest) {
    const sides = new Set(hits.filter((h) => h.gcpId === nearest.gcpId).map((h) => h.side))
    if (sides.size === 2) {
      for (const side of ['image', 'map'] as const) {
        entries.push({
          label: `Remove ${side} point`,
          action: { kind: 'remove', side, gcpId: nearest.gcpId },
          enabled: true,
        })
      }
    } else {
      entries.push({
        label: 'Remove point',
        action: { kind: 'remove', side: nearest.side, gcpId: nearest.gcpId },
        enabled: true,
      })
    }
  }
  return entries
}

export interface ActionResult {
  gcps: Gcp[]
  selected: SideRef | undefined
}

/**
 * Applies a menu action. `at` is the clicked position: map coordinates and, when the
 * click is on the image, the image pixel there. Removing one side of a pair keeps the
 * other side and selects it, so it can be matched again.
 */
export function applyGcpAction(
  gcps: readonly Gcp[],
  action: GcpAction,
  at: { image?: Px; map: LngLat },
  newId: () => string,
): ActionResult {
  switch (action.kind) {
    case 'mark': {
      const id = newId()
      if (action.side === 'image') {
        if (!at.image) return { gcps: [...gcps], selected: undefined }
        return { gcps: [...gcps, { id, image: at.image }], selected: { gcpId: id, side: 'image' } }
      }
      return { gcps: [...gcps, { id, map: at.map }], selected: { gcpId: id, side: 'map' } }
    }
    case 'match': {
      const value = action.side === 'image' ? at.image : at.map
      if (!value) return { gcps: [...gcps], selected: undefined }
      return {
        gcps: gcps.map((g) => (g.id === action.gcpId ? { ...g, [action.side]: value } : g)),
        selected: undefined,
      }
    }
    case 'remove': {
      const gcp = gcps.find((g) => g.id === action.gcpId)
      if (!gcp) return { gcps: [...gcps], selected: undefined }
      const remaining = other(action.side)
      if (gcp[remaining] === undefined) {
        return { gcps: gcps.filter((g) => g.id !== gcp.id), selected: undefined }
      }
      const kept: Gcp = { id: gcp.id, [remaining]: gcp[remaining] }
      return {
        gcps: gcps.map((g) => (g.id === gcp.id ? kept : g)),
        selected: { gcpId: gcp.id, side: remaining },
      }
    }
  }
}

/** GCP sides within `radius` CSS pixels of a click. */
export function hitTest(
  points: readonly (SideRef & { x: number; y: number })[],
  x: number,
  y: number,
  radius = 10,
): Hit[] {
  return points
    .map((p) => ({ gcpId: p.gcpId, side: p.side, distance: Math.hypot(p.x - x, p.y - y) }))
    .filter((h) => h.distance <= radius)
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
  const complete = gcps.filter((g): g is Required<Gcp> => !!(g.image && g.map))
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
