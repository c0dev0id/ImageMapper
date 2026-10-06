import type { GeoJSONSource } from 'maplibre-gl'
import type { Feature, LineString } from 'geojson'
import { createEffect, createMemo, For, onCleanup } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { gcpNumber, moveGcpSide } from '../gcp/gcps.ts'
import type { LngLat } from '../geo/types.ts'
import { warpOf } from '../state/derived.ts'
import { activeLayer, layerById, setLayerGcps } from '../state/project.ts'
import type { Side } from '../state/schema.ts'
import { menu, mode, selection, setSelection } from '../state/ui.ts'
import { useMap } from './context.ts'
import { gcpPointAt, openGcpMenu } from './gcpMenu.ts'
import { MarkerHandle, onMarkerMenu } from './markers.ts'

/** The active layer while georeferencing; GCP markers are hidden in route mode. */
const georefLayer = () => (mode() === 'georef' ? activeLayer() : undefined)

/** Draggable markers for both sides of every GCP of the active layer. */
export function GcpMarkers() {
  const keys = createMemo(
    () => {
      const layer = georefLayer()
      if (!layer) return []
      const out: string[] = []
      for (const g of layer.gcps) {
        if (g.image) out.push(`${layer.id}/${g.id}/image`)
        if (g.map) out.push(`${layer.id}/${g.id}/map`)
      }
      return out
    },
    [],
    { equals: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]) },
  )
  return (
    <For each={keys()}>
      {(key) => {
        const [layerId, gcpId, side] = key.split('/') as [string, string, Side]
        return <GcpMarker layerId={layerId} gcpId={gcpId} side={side} />
      }}
    </For>
  )
}

function GcpMarker(props: { layerId: string; gcpId: string; side: Side }) {
  const map = useMap()
  const { layerId, gcpId, side } = props
  const layer = createMemo(() => layerById(layerId))
  const gcp = createMemo(() => layer()?.gcps.find((g) => g.id === gcpId))
  const position = createMemo((): LngLat | undefined => {
    const g = gcp()
    if (side === 'map') return g?.map && [g.map[0], g.map[1]]
    return g?.image && warpOf(layerId)?.imageToMap([g.image[0], g.image[1]])
  })
  const selected = () => {
    const s = selection()
    return s?.layerId === layerId && s.gcpId === gcpId && s.side === side
  }
  const paired = () => !!(gcp()?.image && gcp()?.map)
  const number = () => gcpNumber(layer()?.gcps ?? [], gcpId)

  const content = (
    <div
      class={`gcp gcp-${side}`}
      classList={{ selected: selected(), unpaired: !paired() }}
      title={`${side === 'image' ? 'Image' : 'Map'} point ${number()}${paired() ? '' : ' (not matched yet)'}`}
    >
      {number()}
    </div>
  ) as HTMLElement
  const handle = new MarkerHandle(map, content, { className: `gcp-marker gcp-marker-${side}`, draggable: true })
  // A finger lifted after a long press may still click; the menu it opened gets that tap.
  handle.root.addEventListener('click', () => {
    if (!menu()) setSelection({ layerId, gcpId, side })
  })
  createEffect(() => handle.setPosition(position()))
  createEffect(() => handle.root.classList.toggle('selected', selected()))

  // Dragging corrects the point: a map point takes the new place, an image point the image
  // pixel there. Dropped beside the image, an image point goes back.
  handle.marker.on('dragend', () => {
    const l = layer()
    const at = gcpPointAt(handle.marker.getLngLat(), warpOf(layerId))
    const value = side === 'map' ? at.map : at.image
    if (l && value) {
      setLayerGcps(layerId, moveGcpSide(unwrap(l.gcps), gcpId, side, value), `Move ${side} point`)
    }
    handle.setPosition(position())
  })
  const stopMenu = onMarkerMenu(handle, (clientX, clientY, touch) => {
    const rect = map.getContainer().getBoundingClientRect()
    const point = { x: clientX - rect.left, y: clientY - rect.top }
    openGcpMenu(map, point, map.unproject([point.x, point.y]), touch)
  })
  onCleanup(() => {
    stopMenu()
    handle.remove()
  })
  return null
}

/** Dashed lines from each image point to its map point; they vanish once a skew matches them. */
export function GcpLinks() {
  const map = useMap()
  createEffect(() => {
    const layer = georefLayer()
    const warp = warpOf(layer?.id)
    const features: Feature<LineString>[] = []
    if (layer && warp) {
      for (const g of layer.gcps) {
        if (!g.image || !g.map) continue
        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [warp.imageToMap([g.image[0], g.image[1]]), [g.map[0], g.map[1]]],
          },
        })
      }
    }
    void map.getSource<GeoJSONSource>('gcp-links')?.setData({ type: 'FeatureCollection', features })
  })
  return null
}
