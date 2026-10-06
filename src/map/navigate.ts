import type { Map as MapLibreMap } from 'maplibre-gl'
import { unwrap } from 'solid-js/store'
import { boundsOf, type Bounds } from '../geo/bounds.ts'
import { fromMercator } from '../geo/mercator.ts'
import { placementInView, type Warp } from '../geo/warp.ts'
import { routePoints } from '../routing/legs.ts'
import { decodePolyline } from '../routing/polyline.ts'
import { setLayerPlacement } from '../state/project.ts'
import type { ImageLayer, Route } from '../state/schema.ts'

/** Moves the view to show the bounds; the map keeps its rotation and tilt. */
export function showBounds(map: MapLibreMap, [west, south, east, north]: Bounds, maxZoom = map.getMaxZoom()): void {
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    { padding: 40, maxZoom, bearing: map.getBearing() },
  )
}

/** Moves the view to show the whole image. */
export function flyToImage(map: MapLibreMap, warp: Warp): void {
  const [minX, minY, maxX, maxY] = warp.bounds
  const [west, north] = fromMercator([minX, minY])
  const [east, south] = fromMercator([maxX, maxY])
  showBounds(map, [west, south, east, north])
}

/** Moves the view to show the whole route, detours of routed legs included. */
export function flyToRoute(map: MapLibreMap, route: Route): void {
  const plain = unwrap(route)
  const bounds = boundsOf([...plain.waypoints.map((w) => w.lngLat), ...routePoints(plain, decodePolyline)])
  if (bounds) showBounds(map, bounds, 16)
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
