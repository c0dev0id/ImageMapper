import type { Map as MapLibreMap } from 'maplibre-gl'
import { unwrap } from 'solid-js/store'
import { boundsOf } from '../geo/bounds.ts'
import type { LngLat, Px } from '../geo/types.ts'
import { searchViewbox, showBounds } from '../map/navigate.ts'
import { searchPlaces, type Viewbox } from '../search/nominatim.ts'
import { imageBlob } from '../state/images.ts'
import { layerById, placeLayer } from '../state/project.ts'
import { setLayerNote } from '../state/ui.ts'
import { placementOf } from './fit.ts'
import { findName } from './names.ts'
import { readWords, type ReadStage } from './ocr.ts'
import { describeSolution, townPairs } from './report.ts'
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

/**
 * Places a layer's image by towns printed on it. The image's words are read (unless every
 * town was picked on the image) while the names without a picked place are looked up as
 * settlements (near the visible area, if zoomed in); picked spots and places are taken as
 * they are. Then each town gets one printed name and one map place so that as many as
 * possible agree. With two or more, the image is placed by the best fit and the towns
 * become point pairs, as one undo step, and the view moves to the image. The note below
 * the layer says what happened.
 */
export async function matchTowns(
  map: MapLibreMap,
  layerId: string,
  towns: readonly TownInput[],
  onProgress: (progress: MatchProgress) => void,
  signal: AbortSignal,
): Promise<TownSolution> {
  const layer = layerById(layerId)
  const image = layer && imageBlob(layer.id, layer.mime)
  if (!layer || !image) throw new Error('The image of this layer is not available.')

  const unpicked = towns.filter((t) => !t.at).map((t) => t.name)
  const reading = towns.some((t) => !t.image)
  let progress: MatchProgress = {
    reading: reading ? { stage: 'loading' } : undefined,
    lookedUp: 0,
    total: unpicked.length,
  }
  const report = (change: Partial<MatchProgress>) => {
    progress = { ...progress, ...change }
    onProgress(progress)
  }
  report({})
  const [words, places] = await Promise.all([
    reading
      ? readWords(layer.id, image, (stage, share) => report({ reading: { stage, share } }), signal).then((words) => {
          report({ reading: undefined })
          return words
        })
      : [],
    lookUp(unpicked, searchViewbox(map), () => report({ lookedUp: progress.lookedUp + 1 }), signal),
  ])
  signal.throwIfAborted()

  const found = new Map(unpicked.map((name, i) => [name, places[i]]))
  const solution = solveTowns(
    towns.map((town) => ({
      name: town.name,
      image: town.image ? [town.image] : findName(town.name, words).map((hit) => hit.at),
      map: town.at ? [town.at] : (found.get(town.name) ?? []),
    })),
    layer.width,
    layer.height,
  )
  const current = layerById(layerId)
  if (!solution.fit || !current) return solution

  const placement = placementOf(solution.fit, current.width, current.height)
  const gcps = unwrap(current.gcps)
  placeLayer(current.id, placement, [...gcps, ...townPairs(solution.matches, gcps, () => crypto.randomUUID())], 'Match towns')
  const bounds = boundsOf(placement.map((p) => p.map))
  if (bounds) showBounds(map, bounds)
  setLayerNote({
    layerId,
    kind: solution.misses.length > 0 || solution.matches.length < 3 ? 'warning' : 'info',
    text: describeSolution(solution),
  })
  return solution
}

/** Map places per name, best first; the shared search keeps Nominatim's request spacing. */
async function lookUp(
  names: readonly string[],
  viewbox: Viewbox | undefined,
  onEach: () => void,
  signal: AbortSignal,
): Promise<LngLat[][]> {
  const found: LngLat[][] = []
  for (const name of names) {
    signal.throwIfAborted()
    const places = await searchPlaces(name, { viewbox, settlement: true })
    found.push(places.map((place) => place.center))
    onEach()
  }
  return found
}
