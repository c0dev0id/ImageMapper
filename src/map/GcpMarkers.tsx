import type { GeoJSONSource } from 'maplibre-gl'
import type { Feature, LineString } from 'geojson'
import { createEffect, createMemo, For, onCleanup } from 'solid-js'
import { gcpNumber } from '../gcp/gcps.ts'
import type { LngLat } from '../geo/types.ts'
import { warpOf } from '../state/derived.ts'
import { activeLayer, layerById } from '../state/project.ts'
import type { Side } from '../state/schema.ts'
import { mode, selection, setSelection } from '../state/ui.ts'
import { useMap } from './context.ts'
import { MarkerHandle } from './markers.ts'

/** The active layer while georeferencing; GCP markers are hidden in route mode. */
const georefLayer = () => (mode() === 'georef' ? activeLayer() : undefined)

/** Markers for both sides of every GCP of the active layer. */
export function GcpMarkers() {
  const keys = createMemo(
    () => {
      const layer = georefLayer()
      if (!layer) return []
      const out: string[] = []
      for (const g of layer.gcps) {
        // Image points are only shown (and hit-tested) while the image itself is visible.
        if (g.image && layer.visible) out.push(`${layer.id}/${g.id}/image`)
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
  const handle = new MarkerHandle(map, content, { className: `gcp-marker gcp-marker-${side}` })
  handle.root.addEventListener('click', () => setSelection({ layerId, gcpId, side }))
  createEffect(() => handle.setPosition(position()))
  createEffect(() => handle.root.classList.toggle('selected', selected()))
  onCleanup(() => handle.remove())
  return null
}

/** Dashed lines from each image point to its map point; they vanish once a skew matches them. */
export function GcpLinks() {
  const map = useMap()
  createEffect(() => {
    const layer = georefLayer()
    const warp = warpOf(layer?.id)
    const features: Feature<LineString>[] = []
    if (layer?.visible && warp) {
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
