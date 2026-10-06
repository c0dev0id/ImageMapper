import type { Map as MapLibreMap } from 'maplibre-gl'
import { unwrap } from 'solid-js/store'
import { flyToImage } from '../map/navigate.ts'
import { warpOf } from '../state/derived.ts'
import { layerById, placeLayer } from '../state/project.ts'
import { setLayerNote } from '../state/ui.ts'
import { placementOf } from './fit.ts'
import { describeMatch, replaceTownPairs } from './report.ts'
import { fitTowns, type TownFit, type TownPair } from './solve.ts'

/**
 * Places a layer's image by towns picked on both sides: each spot on the image goes onto
 * its place on the map, as well as the towns agree. The towns that fit become point pairs
 * in place of those the previous match made, in one undo step with the new placement; the
 * view moves to the image, and the note below the layer says what happened. Nothing
 * changes when no two towns fit.
 */
export function matchTowns(map: MapLibreMap, layerId: string, towns: readonly TownPair[]): TownFit {
  const layer = layerById(layerId)
  if (!layer) return { misfits: [] }
  const result = fitTowns(towns, layer.width, layer.height)
  if (!result.fit) return result

  const fitting = towns.filter((_, i) => !result.misfits.includes(i))
  const gcps = replaceTownPairs(unwrap(layer.gcps), fitting, () => crypto.randomUUID())
  placeLayer(layer.id, placementOf(result.fit, layer.width, layer.height), gcps, 'Match towns')
  const warp = warpOf(layer.id)
  if (warp) flyToImage(map, warp)
  setLayerNote({ layerId, ...describeMatch(towns, result.misfits) })
  return result
}
