import type { LngLat as MapLibreLngLat, Map as MapLibreMap } from 'maplibre-gl'
import { unwrap } from 'solid-js/store'
import { applyGcpAction, gcpMenu, hitTest, pinAction, pinEnabled, type SideRef } from '../gcp/gcps.ts'
import type { LngLat, Px } from '../geo/types.ts'
import type { Warp } from '../geo/warp.ts'
import { warpOf } from '../state/derived.ts'
import { activeLayer, setLayerGcps } from '../state/project.ts'
import type { Side } from '../state/schema.ts'
import { selection, setMenu, setSelection, setTool } from '../state/ui.ts'

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits

/**
 * A place on the map as GCP coordinates: the map position (7 decimals, about 1 cm) and,
 * where the image is drawn, its pixel there (2 decimals).
 */
export function gcpPointAt(lngLat: MapLibreLngLat, warp: Warp | undefined): { map: LngLat; image?: Px } {
  const wrapped = lngLat.wrap()
  const map: LngLat = [round(wrapped.lng, 7), round(wrapped.lat, 7)]
  const pixel = warp?.mapToImage(map)
  return { map, image: pixel && [round(pixel[0], 2), round(pixel[1], 2)] }
}

/**
 * Places a point with a pin tool: it completes the selected point if that waits for this
 * side, or starts a new one. The pin of the other side is picked next, so pairs are
 * pinned in turns. Image pins need a place on the active, visible image.
 */
export function placePin(side: Side, lngLat: MapLibreLngLat): void {
  const layer = activeLayer()
  if (!layer) return
  const at = gcpPointAt(lngLat, layer.visible ? warpOf(layer.id) : undefined)
  if (side === 'image' && !at.image) return
  const sel = selection()
  const selected =
    sel && sel.layerId === layer.id && layer.gcps.some((g) => g.id === sel.gcpId)
      ? { gcpId: sel.gcpId, side: sel.side }
      : undefined
  if (!pinEnabled(side, selected)) return
  const action = pinAction(side, selected)
  const result = applyGcpAction(unwrap(layer.gcps), action, at, () => crypto.randomUUID())
  setLayerGcps(layer.id, result.gcps, `${action.kind === 'match' ? 'Match' : 'Mark'} point on ${side}`)
  setSelection(result.selected && { layerId: layer.id, ...result.selected })
  setTool(side === 'map' ? 'pin-image' : 'pin-map')
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
  const at = gcpPointAt(lngLat, layer?.visible ? warp : undefined)

  const sides: (SideRef & { x: number; y: number })[] = []
  for (const g of layer?.gcps ?? []) {
    if (g.image && layer?.visible && warp) {
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
        const result = applyGcpAction(unwrap(target.gcps), entry.action, at, () =>
          crypto.randomUUID(),
        )
        setLayerGcps(target.id, result.gcps, entry.label)
        setSelection(result.selected && { layerId: target.id, ...result.selected })
      },
    })),
  })
}
