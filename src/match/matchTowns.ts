import type { Map as MapLibreMap } from 'maplibre-gl'
import { unwrap } from 'solid-js/store'
import type { LngLat, Px } from '../geo/types.ts'
import { flyToImage } from '../map/navigate.ts'
import { searchPlaces, type Viewbox } from '../search/nominatim.ts'
import { warpOf } from '../state/derived.ts'
import { imageBlob } from '../state/images.ts'
import { layerById, placeLayer } from '../state/project.ts'
import { setLayerNote } from '../state/ui.ts'
import { placementOf } from './fit.ts'
import { findName } from './names.ts'
import { readWords, type ReadStage } from './ocr.ts'
import { describeSolution, replaceTownPairs } from './report.ts'
import { solveTowns, type TownSolution } from './solve.ts'

/** A name as printed on the image, with where it is printed and its place on the map if the user picked them. */
export interface TownInput {
  name: string
  image?: Px
  at?: LngLat
}

export interface MatchProgress {
  /** Text recognition; undefined once the words are read. */
  reading?: { stage: ReadStage; share?: number }
  lookedUp: number
  total: number
}

export interface MatchOptions {
  /** Area to prefer when looking the towns up. */
  viewbox?: Viewbox
  onProgress: (progress: MatchProgress) => void
  signal: AbortSignal
}

/**
 * Places a layer's image by towns printed on it. The image's words are read (unless every
 * town was picked on the image) while the names without a picked place are looked up as
 * settlements; picked spots and places are taken as they are. Then each town gets one
 * printed name and one map place so that as many as possible agree. With two or more,
 * the image is placed by the best fit and the towns become point pairs in place of those
 * the previous match made, as one undo step, and the view moves to the image. The note
 * below the layer says what happened.
 */
export async function matchTowns(
  map: MapLibreMap,
  layerId: string,
  towns: readonly TownInput[],
  { viewbox, onProgress, signal }: MatchOptions,
): Promise<TownSolution> {
  const layer = layerById(layerId)
  const image = layer && imageBlob(layer.id, layer.mime)
  if (!layer || !image) throw new Error('The image of this layer is not available.')

  // Reading and looking up run side by side; when one fails, the other stops too.
  const failure = new AbortController()
  const linked = AbortSignal.any([signal, failure.signal])
  const stopBoth = (error: unknown): never => {
    failure.abort(error)
    throw error
  }
  const unpicked = [...new Set(towns.filter((t) => !t.at).map((t) => t.name))]
  let progress: MatchProgress = { lookedUp: 0, total: unpicked.length }
  const report = (change: Partial<MatchProgress>) => {
    if (linked.aborted) return
    progress = { ...progress, ...change }
    onProgress(progress)
  }
  report({})
  const [words, found] = await Promise.all([
    towns.some((t) => !t.image)
      ? readWords(layer.id, image, (stage, share) => report({ reading: { stage, share } }), linked)
          .then((words) => {
            report({ reading: undefined })
            return words
          })
          .catch(stopBoth)
      : [],
    lookUp(unpicked, viewbox, () => report({ lookedUp: progress.lookedUp + 1 }), linked).catch(stopBoth),
  ])
  signal.throwIfAborted()

  const solution = solveTowns(
    towns.map((town) => ({
      name: town.name,
      image: town.image ? [town.image] : findName(town.name, words),
      map: town.at ? [town.at] : (found.get(town.name) ?? []),
    })),
    layer.width,
    layer.height,
  )
  const current = layerById(layerId)
  if (!solution.fit || !current) return solution

  const placement = placementOf(solution.fit, current.width, current.height)
  const gcps = replaceTownPairs(unwrap(current.gcps), solution.matches, () => crypto.randomUUID())
  placeLayer(current.id, placement, gcps, 'Match towns')
  const warp = warpOf(current.id)
  if (warp) flyToImage(map, warp)
  setLayerNote({ layerId, ...describeSolution(solution) })
  return solution
}

/**
 * Map places per name, best first: settlements, or any kind of place (a pass, a peak) when
 * no settlement has the name. The shared search keeps Nominatim's request spacing.
 */
async function lookUp(
  names: readonly string[],
  viewbox: Viewbox | undefined,
  onEach: () => void,
  signal: AbortSignal,
): Promise<Map<string, LngLat[]>> {
  const found = new Map<string, LngLat[]>()
  for (const name of names) {
    signal.throwIfAborted()
    let places = await searchPlaces(name, { viewbox, settlement: true })
    if (places.length === 0) {
      signal.throwIfAborted()
      places = await searchPlaces(name, { viewbox })
    }
    found.set(name, places.map((place) => place.center))
    onEach()
  }
  return found
}
