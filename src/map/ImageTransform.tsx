import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { createEffect, createMemo, onCleanup, Show } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { toMercator } from '../geo/mercator.ts'
import { angleBetween, scaleBetween, transformPlacement, type Similarity } from '../geo/similarity.ts'
import type { LngLat, Merc, Pair } from '../geo/types.ts'
import { warpOf } from '../state/derived.ts'
import { activeLayer, layerById, recordUndoStep, setLayerPlacement } from '../state/project.ts'
import { mode, stopTransform } from '../state/ui.ts'
import { useMap } from './context.ts'
import { fromMarker, MarkerHandle } from './markers.ts'
import { EMPTY_COLLECTION } from './style.ts'

/** The image being transformed: the active layer while in transform mode. */
function target() {
  if (mode() !== 'transform') return undefined
  const layer = activeLayer()
  return layer?.visible ? layer : undefined
}

/** Movement in CSS pixels before a press on the image becomes a move. */
const MOVE_THRESHOLD = 3

/** Limits of one resize gesture, so the image cannot collapse to a point. */
const MIN_SCALE = 0.05
const MAX_SCALE = 20

/**
 * Move, rotate and resize the active image: drag the image itself to move it, a corner
 * handle to resize it (uniformly, around its centre) and the round handle to rotate it.
 * Every gesture is one undo step; the point pairs of the layer are not touched.
 */
export function ImageTransform() {
  const map = useMap()

  // Nothing to transform once the active layer is gone or hidden.
  createEffect(() => {
    if (mode() === 'transform' && !activeLayer()?.visible) stopTransform()
  })

  createEffect(() => {
    const layer = target()
    const warp = layer && warpOf(layer.id)
    void map.getSource<GeoJSONSource>('image-frame')?.setData(
      warp
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: warp.outline() } }
        : EMPTY_COLLECTION,
    )
  })

  useBodyDrag(map)

  return (
    <Show when={target()} keyed>
      {(layer) => <Handles layerId={layer.id} />}
    </Show>
  )
}

/** Dragging the image moves it; elsewhere the map pans as usual. */
function useBodyDrag(map: MapLibreMap) {
  const container = map.getCanvasContainer()
  const canvas = map.getCanvas()
  let drag:
    | { layerId: string; pointerId: number; x: number; y: number; start: Merc; pairs: Pair[]; moving: boolean }
    | undefined

  const lngLatAt = (e: PointerEvent): LngLat => {
    const rect = container.getBoundingClientRect()
    const { lng, lat } = map.unproject([e.clientX - rect.left, e.clientY - rect.top])
    return [lng, lat]
  }
  const imageAt = (e: PointerEvent) => {
    const layer = target()
    return layer && warpOf(layer.id)?.mapToImage(lngLatAt(e)) ? layer : undefined
  }

  const endDrag = () => {
    drag = undefined
    map.dragPan.enable()
  }
  const onPointerDown = (e: PointerEvent) => {
    // A second finger makes it a pinch of the map; the image stays where the first one left it.
    if (drag) return endDrag()
    if (!e.isPrimary || e.button !== 0 || fromMarker(e)) return
    const layer = imageAt(e)
    if (!layer) return
    // Runs before MapLibre sees the press, so this gesture moves the image, not the map.
    map.dragPan.disable()
    drag = {
      layerId: layer.id,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      start: toMercator(lngLatAt(e)),
      pairs: structuredClone(unwrap(layer.placement)),
      moving: false,
    }
  }
  const onHover = (e: PointerEvent) => {
    if (!drag && e.pointerType === 'mouse' && target()) canvas.style.cursor = imageAt(e) ? 'move' : ''
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId || target()?.id !== drag.layerId) return
    if (!drag.moving) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < MOVE_THRESHOLD) return
      drag.moving = true
      recordUndoStep('Move image')
    }
    const [x, y] = toMercator(lngLatAt(e))
    setLayerPlacement(drag.layerId, transformPlacement(drag.pairs, { translate: [x - drag.start[0], y - drag.start[1]] }))
  }
  const onPointerUp = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.pointerId) endDrag()
  }

  container.addEventListener('pointerdown', onPointerDown, true)
  container.addEventListener('pointermove', onHover)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  createEffect(() => {
    if (!target()) canvas.style.cursor = ''
  })
  onCleanup(() => {
    container.removeEventListener('pointerdown', onPointerDown, true)
    container.removeEventListener('pointermove', onHover)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    if (drag) map.dragPan.enable()
    canvas.style.cursor = ''
  })
}

/** Resize handles on the corners and a rotate handle on the middle of the top edge. */
function Handles(props: { layerId: string }) {
  const map = useMap()
  const id = props.layerId
  const layer = createMemo(() => layerById(id))
  /** Map position of a point given as a fraction of the image size. */
  const at = (fx: number, fy: number) => () => {
    const l = layer()
    return l && warpOf(id)?.imageToMap([fx * l.width, fy * l.height])
  }
  createHandle(map, id, 'resize nwse', at(0, 0))
  createHandle(map, id, 'resize nesw', at(1, 0))
  createHandle(map, id, 'resize nwse', at(1, 1))
  createHandle(map, id, 'resize nesw', at(0, 1))
  createHandle(map, id, 'rotate', at(0.5, 0))
  return null
}

function createHandle(
  map: MapLibreMap,
  layerId: string,
  kind: 'resize nwse' | 'resize nesw' | 'rotate',
  position: () => LngLat | undefined,
) {
  const rotate = kind === 'rotate'
  const content = document.createElement('div')
  content.className = `transform-handle ${kind}`
  content.title = rotate ? 'Drag to rotate' : 'Drag to resize'
  const handle = new MarkerHandle(map, content, { className: 'transform-handle-marker', draggable: true })
  let gesture: { pairs: Pair[]; pivot: Merc; from: Merc } | undefined

  // Also while dragging: the handle stays on the image instead of following the pointer.
  createEffect(() => handle.setPosition(position()))
  handle.marker.on('dragstart', () => {
    const layer = layerById(layerId)
    const warp = warpOf(layerId)
    // Where the handle sat when pressed; the marker itself has already moved by the drag threshold.
    const from = position()
    if (!layer || !warp || !from) return
    recordUndoStep(rotate ? 'Rotate image' : 'Resize image')
    gesture = { pairs: structuredClone(unwrap(layer.placement)), pivot: warp.center, from: toMercator(from) }
  })
  handle.marker.on('drag', () => {
    if (!gesture) return
    // During a drag MapLibre places the marker under the pointer before this event.
    const { lng, lat } = handle.marker.getLngLat()
    const to = toMercator([lng, lat])
    const change: Similarity = rotate
      ? { angle: angleBetween(gesture.pivot, gesture.from, to), pivot: gesture.pivot }
      : {
          scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleBetween(gesture.pivot, gesture.from, to))),
          pivot: gesture.pivot,
        }
    setLayerPlacement(layerId, transformPlacement(gesture.pairs, change))
  })
  handle.marker.on('dragend', () => {
    gesture = undefined
    handle.setPosition(position())
  })
  onCleanup(() => handle.remove())
}
