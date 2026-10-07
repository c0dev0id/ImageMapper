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

/** What a menu entry does: start a new pair (its image point first), or remove a pair. */
export type GcpAction = { kind: 'pin' } | { kind: 'remove'; gcpId: string }

export interface MenuEntry {
  label: string
  action: GcpAction
  enabled: boolean
}

export interface MenuInput {
  /** GCPs of the active layer; undefined when there is no active layer. */
  gcps: readonly Gcp[] | undefined
  /** The GCP whose ring or dot is under the click, if any. */
  hit: string | undefined
  /** Whether the click lies on the active, visible image. */
  onImage: boolean
}

/**
 * Context menu entries for a right-click in georeferencing mode. A new pair always starts
 * with its image point, at the click; its place on the map is the next tap. A ring or dot
 * under the click offers to remove its pair, named by its number: both sides go together.
 */
export function gcpMenu({ gcps, hit, onImage }: MenuInput): MenuEntry[] {
  const entries: MenuEntry[] = [
    { label: 'Pin point on image', action: { kind: 'pin' }, enabled: gcps !== undefined && onImage },
  ]
  if (hit && gcps) {
    entries.push({
      label: `Remove point pair ${gcpNumber(gcps, hit)}`,
      action: { kind: 'remove', gcpId: hit },
      enabled: true,
    })
  }
  return entries
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
