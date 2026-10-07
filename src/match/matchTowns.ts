import type { Map as MapLibreMap } from 'maplibre-gl'
import { flyToImage } from '../map/navigate.ts'
import { warpOf } from '../state/derived.ts'
import { layerById, setLayerPlacement } from '../state/project.ts'
import { setLayerNote } from '../state/ui.ts'
import { placementOf } from './fit.ts'
import { describeMatch, type MatchNote } from './report.ts'
import { fitTowns, type TownPair } from './towns.ts'

/** What a match did: the positions of the towns it left out, and the note it put below the layer. */
export interface MatchResult {
  misfits: number[]
  note: MatchNote
}

/**
 * Places a layer's image by towns picked on both sides: each spot on the image goes onto
 * its place on the map, as well as the towns agree. Only the placement changes, in one
 * undo step: towns are too rough to keep as point pairs, and their markers would be in
 * the way of the pairs pinned for a closer fit. The view moves to the image, and the note
 * below the layer says what happened. Undefined, and nothing changes, when no two towns fit.
 */
export function matchTowns(map: MapLibreMap, layerId: string, towns: readonly TownPair[]): MatchResult | undefined {
  const layer = layerById(layerId)
  const { fit, misfits } = layer ? fitTowns(towns, layer.width, layer.height) : { misfits: [] }
  if (!layer || !fit) return undefined

  setLayerPlacement(layer.id, placementOf(fit, layer.width, layer.height), 'Match towns')
  const warp = warpOf(layer.id)
  if (warp) flyToImage(map, warp)
  const left = new Set(misfits)
  const note = describeMatch(
    towns.filter((_, i) => !left.has(i)).map((t) => t.name),
    misfits.map((i) => towns[i].name),
  )
  setLayerNote({ layerId, ...note })
  return { misfits, note }
}
