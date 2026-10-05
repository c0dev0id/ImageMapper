import { createMemo, createRoot, mapArray, type Accessor } from 'solid-js'
import type { LngLat, Pair, Px } from '../geo/types.ts'
import { Warp } from '../geo/warp.ts'
import { layerById, project } from './project.ts'

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i])
}

/**
 * Derived state shared by the map and the panel. Memos are keyed by id so that edits of
 * one layer (or reordering) never rebuild the warp of another.
 */
const derived = createRoot(() => {
  const layerIds = createMemo(() => project.layers.map((l) => l.id), [], { equals: sameItems })

  const warpEntries = mapArray(layerIds, (id) => {
    // The store keeps one proxy per layer; this memo only changes if the layer is replaced.
    const layer = createMemo(() => layerById(id))
    const warp = createMemo((): Warp | undefined => {
      const l = layer()
      if (!l) return undefined
      const pairs: Pair[] = l.placement.map((p) => ({
        image: [p.image[0], p.image[1]] as Px,
        map: [p.map[0], p.map[1]] as LngLat,
      }))
      try {
        return new Warp(pairs, l.width, l.height)
      } catch (error) {
        console.error(`Layer ${id}: invalid placement`, error)
        return undefined
      }
    })
    return [id, warp] as const
  })
  const warps = createMemo(() => new Map(warpEntries()))

  return { layerIds, warps }
})

/** Ids of all image layers, bottom first; only changes when layers are added, removed or moved. */
export const layerIds: Accessor<string[]> = derived.layerIds

/** The current warp of an image layer (reactive). */
export function warpOf(id: string | undefined): Warp | undefined {
  return id === undefined ? undefined : derived.warps().get(id)?.()
}
