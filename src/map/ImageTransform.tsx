import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, MapTouchEvent, Point } from 'maplibre-gl'
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
import { EMPTY_COLLECTION, IMAGE_HIT_LAYER } from './style.ts'

/** The image being transformed: the active layer while in transform mode, hidden or not. */
function target() {
  return mode() === 'transform' ? activeLayer() : undefined
}

/** Movement in CSS pixels before a press on the image becomes a move. */
const MOVE_THRESHOLD = 3

/** Limits of one resize gesture, so the image cannot collapse to a point. */
const MIN_SCALE = 0.05
const MAX_SCALE = 20

/**
 * Move, rotate and resize the active image: drag the image itself to move it, a corner
 * handle to resize it (uniformly, around its centre) and the round handle to rotate it.
 * Only the active layer's image reacts, also where other images are drawn over it. Every
 * gesture is one undo step; the point pairs of the layer are not touched.
 */
export function ImageTransform() {
  const map = useMap()

  // Nothing to transform once the active layer is gone.
  createEffect(() => {
    if (mode() === 'transform' && !activeLayer()) stopTransform()
  })

  // The footprint of the image as drawn: a dashed frame, and the hit area for moving it.
  createEffect(() => {
    const layer = target()
    const warp = layer && warpOf(layer.id)
    void map.getSource<GeoJSONSource>('image-frame')?.setData(
      warp
        ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [warp.outline()] } }
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

/**
 * Dragging the image moves it. The press arrives as a MapLibre layer event on the hit
 * layer, which holds only the active image: it is found even below other images, and
 * preventing the event keeps the map's own pan, pinch and long press out of the gesture.
 * Elsewhere the map pans as usual.
 */
function useBodyDrag(map: MapLibreMap) {
  const canvas = map.getCanvas()
  let drag: { layerId: string; point: Point; start: Merc; pairs: Pair[]; moving: boolean } | undefined
  const mercatorAt = (e: MapMouseEvent | MapTouchEvent): Merc => toMercator([e.lngLat.lng, e.lngLat.lat])

  const onPress = (e: MapMouseEvent | MapTouchEvent) => {
    const layer = target()
    if (!layer || fromMarker(e.originalEvent)) return
    // A pinch or another mouse button stays with the map.
    if ('points' in e ? e.points.length !== 1 : e.originalEvent.button !== 0) return
    e.preventDefault()
    drag = {
      layerId: layer.id,
      point: e.point,
      start: mercatorAt(e),
      pairs: structuredClone(unwrap(layer.placement)),
      moving: false,
    }
  }
  const onMove = (e: MapMouseEvent | MapTouchEvent) => {
    if (!drag) return
    // A second finger hands the gesture to the map; a button released off the map ends it.
    const ended = 'points' in e ? e.points.length !== 1 : e.originalEvent.buttons === 0
    if (ended || target()?.id !== drag.layerId) {
      drag = undefined
      return
    }
    if (!drag.moving) {
      if (e.point.dist(drag.point) < MOVE_THRESHOLD) return
      drag.moving = true
      recordUndoStep('Move image')
    }
    const [x, y] = mercatorAt(e)
    setLayerPlacement(drag.layerId, transformPlacement(drag.pairs, { translate: [x - drag.start[0], y - drag.start[1]] }))
  }
  const onRelease = () => {
    drag = undefined
  }
  const onEnter = () => {
    canvas.style.cursor = 'move'
  }
  const onLeave = () => {
    canvas.style.cursor = ''
  }

  map.on('mousedown', IMAGE_HIT_LAYER, onPress)
  map.on('touchstart', IMAGE_HIT_LAYER, onPress)
  map.on('mousemove', onMove)
  map.on('touchmove', onMove)
  map.on('mouseup', onRelease)
  map.on('touchend', onRelease)
  map.on('touchcancel', onRelease)
  map.on('mouseenter', IMAGE_HIT_LAYER, onEnter)
  map.on('mouseleave', IMAGE_HIT_LAYER, onLeave)
  createEffect(() => {
    if (!target()) canvas.style.cursor = ''
  })
  onCleanup(() => {
    map.off('mousedown', IMAGE_HIT_LAYER, onPress)
    map.off('touchstart', IMAGE_HIT_LAYER, onPress)
    map.off('mousemove', onMove)
    map.off('touchmove', onMove)
    map.off('mouseup', onRelease)
    map.off('touchend', onRelease)
    map.off('touchcancel', onRelease)
    map.off('mouseenter', IMAGE_HIT_LAYER, onEnter)
    map.off('mouseleave', IMAGE_HIT_LAYER, onLeave)
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
