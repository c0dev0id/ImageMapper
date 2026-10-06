import type { Map as MapLibreMap } from 'maplibre-gl'
import { unwrap } from 'solid-js/store'
import { fromMercator } from '../geo/mercator.ts'
import { placementInView, type Warp } from '../geo/warp.ts'
import { setLayerPlacement } from '../state/project.ts'
import type { ImageLayer } from '../state/schema.ts'

/** Moves the view to show the whole image; the map keeps its rotation and tilt. */
export function flyToImage(map: MapLibreMap, warp: Warp): void {
  const [minX, minY, maxX, maxY] = warp.bounds
  map.fitBounds([fromMercator([minX, maxY]), fromMercator([maxX, minY])], { padding: 40, bearing: map.getBearing() })
}

/** Moves the image to the middle of the view at the size of a new image (one undo step). */
export function moveImageHere(map: MapLibreMap, layer: ImageLayer, warp: Warp): void {
  const { lng, lat } = map.getCenter()
  const container = map.getContainer()
  const placement = placementInView(
    unwrap(layer.placement),
    warp,
    [lng, lat],
    map.getZoom(),
    container.clientWidth,
    container.clientHeight,
  )
  setLayerPlacement(layer.id, placement, 'Move image here')
}
