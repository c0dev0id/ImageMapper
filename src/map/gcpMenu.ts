import type { LngLat as MapLibreLngLat, Map as MapLibreMap } from 'maplibre-gl'
import { unwrap } from 'solid-js/store'
import { applyGcpAction, gcpMenu, hitTest, roundImagePoint, roundMapPoint, type SideRef } from '../gcp/gcps.ts'
import type { LngLat, Px } from '../geo/types.ts'
import type { Warp } from '../geo/warp.ts'
import { warpOf } from '../state/derived.ts'
import { activeLayer, layerById, setLayerGcps } from '../state/project.ts'
import type { Gcp, ImageLayer } from '../state/schema.ts'
import { requestTap, selection, setMenu, setPendingPin, setSelection } from '../state/ui.ts'

/** A place on the map as GCP coordinates: the map position and, where the image is drawn, its pixel there. */
export function gcpPointAt(lngLat: MapLibreLngLat, warp: Warp | undefined): { map: LngLat; image?: Px } {
  const wrapped = lngLat.wrap()
  const map = roundMapPoint([wrapped.lng, wrapped.lat])
  const pixel = warp?.mapToImage(map)
  return { map, image: pixel && roundImagePoint(pixel) }
}

/** The warp a tap becomes a new image point through: none while the image is hidden. */
export function newPointWarp(layer: ImageLayer | undefined): Warp | undefined {
  return layer?.visible ? warpOf(layer.id) : undefined
}

/**
 * Pins the image point of a new pair where the image was tapped; the next tap on the map
 * pins its place and makes the pair. Esc, Cancel or picking another tool drop the image
 * point, which is only stored together with its place.
 */
export function startPin(lngLat: MapLibreLngLat): void {
  const layer = activeLayer()
  const image = layer && gcpPointAt(lngLat, newPointWarp(layer)).image
  if (!layer || !image) return
  const layerId = layer.id
  setSelection(undefined)
  setPendingPin({ layerId, image })
  requestTap({
    hint: 'Now tap the same place on the map.',
    onTap: (map) => {
      setPendingPin(undefined)
      const target = layerById(layerId)
      if (!target) return
      const pair: Gcp = { id: crypto.randomUUID(), image, map: roundMapPoint(map) }
      setLayerGcps(layerId, [...unwrap(target.gcps), pair], 'Pin point pair')
    },
    onCancel: () => setPendingPin(undefined),
  })
}

/** Opens the georeferencing context menu for a right-click at `point` / `lngLat`. */
export function openGcpMenu(
  map: MapLibreMap,
  point: { x: number; y: number },
  lngLat: MapLibreLngLat,
  touch: boolean,
): void {
  const layer = activeLayer()
  const warp = warpOf(layer?.id)
  const at = gcpPointAt(lngLat, newPointWarp(layer))

  const sides: (SideRef & { x: number; y: number })[] = []
  for (const g of layer?.gcps ?? []) {
    if (g.image && warp) {
      const p = map.project(warp.imageToMap([g.image[0], g.image[1]]))
      sides.push({ gcpId: g.id, side: 'image', x: p.x, y: p.y })
    }
    if (g.map) {
      const p = map.project([g.map[0], g.map[1]])
      sides.push({ gcpId: g.id, side: 'map', x: p.x, y: p.y })
    }
  }
  const sel = selection()
  const entries = gcpMenu({
    gcps: layer && unwrap(layer.gcps),
    selected: sel && sel.layerId === layer?.id ? { gcpId: sel.gcpId, side: sel.side } : undefined,
    hits: hitTest(sides, point.x, point.y, touch ? 22 : 10),
    onImage: at.image !== undefined,
  })

  setMenu({
    x: point.x,
    y: point.y,
    touch,
    items: entries.map((entry) => ({
      label: entry.label,
      enabled: entry.enabled,
      run: () => {
        const target = activeLayer()
        if (!target || target.id !== layer?.id) return
        if (entry.action.kind === 'pin') {
          startPin(lngLat)
          return
        }
        const result = applyGcpAction(unwrap(target.gcps), entry.action, at)
        setLayerGcps(target.id, result.gcps, entry.label)
        setSelection(result.selected && { layerId: target.id, ...result.selected })
      },
    })),
  })
}
