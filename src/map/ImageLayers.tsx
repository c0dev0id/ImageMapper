import { createEffect, createMemo, For, onCleanup } from 'solid-js'
import { layerIds, warpOf } from '../state/derived.ts'
import { imageBlob } from '../state/images.ts'
import { layerById } from '../state/project.ts'
import { useMap } from './context.ts'
import { FIRST_OVERLAY_LAYER } from './style.ts'
import { WarpedImageLayer } from './WarpedImageLayer.ts'

/** Mirrors the project's image layers into MapLibre custom layers, in stacking order. */
export function ImageLayers() {
  const map = useMap()
  // Children add their layer below the overlays while rendering; this restores the order
  // after layers were moved (effects run after the children were created).
  createEffect(() => {
    for (const id of layerIds()) if (map.getLayer(id)) map.moveLayer(id, FIRST_OVERLAY_LAYER)
  })
  return <For each={layerIds()}>{(id) => <ImageLayer id={id} />}</For>
}

function ImageLayer(props: { id: string }) {
  const map = useMap()
  const id = props.id
  const layer = createMemo(() => layerById(id))
  const mime = layer()?.mime ?? ''
  const glLayer = new WarpedImageLayer(id, async () => {
    const blob = imageBlob(id, mime)
    if (!blob) throw new Error('image bytes are missing')
    return blob
  })
  map.addLayer(glLayer, FIRST_OVERLAY_LAYER)
  onCleanup(() => {
    if (map.getLayer(id)) map.removeLayer(id)
  })

  createEffect(() => {
    const warp = warpOf(id)
    if (warp) glLayer.setWarp(warp)
  })
  createEffect(() => glLayer.setOpacity(layer()?.opacity ?? 0))
  createEffect(() => {
    map.setLayoutProperty(id, 'visibility', layer()?.visible ? 'visible' : 'none')
  })
  return null
}
