import type { MapMouseEvent } from 'maplibre-gl'
import { onCleanup } from 'solid-js'
import { roundLngLat } from '../routing/legs.ts'
import { appendWaypoint, redo, undo } from '../state/project.ts'
import { editingRouteId, menu, mode, setMenu, setSelection, stopDrawing, stopTransform } from '../state/ui.ts'
import { useMap } from './context.ts'
import { openGcpMenu } from './gcpMenu.ts'
import { fromMarker } from './markers.ts'

/** Mouse and keyboard handling on the map that depends on the current mode. */
export function Interactions() {
  const map = useMap()
  const container = map.getCanvasContainer()

  // MapLibre turns a touch held for 500 ms into a contextmenu event. The browser may still
  // send a click when that finger lifts; it must neither close the menu nor add a point.
  let pointerType = 'mouse'
  let swallowClick = false
  const onPointerDown = (e: PointerEvent) => {
    pointerType = e.pointerType
    swallowClick = false
  }

  const onContextMenu = (e: MapMouseEvent) => {
    e.preventDefault()
    const touch = pointerType !== 'mouse'
    if (touch) swallowClick = true
    if (mode() === 'georef') openGcpMenu(map, e.point, e.lngLat, touch)
  }
  const onClick = (e: MapMouseEvent) => {
    if (swallowClick) {
      swallowClick = false
      return
    }
    if (fromMarker(e.originalEvent)) return
    setMenu(undefined)
    const routeId = editingRouteId()
    if (mode() === 'route' && routeId) {
      const { lng, lat } = e.lngLat.wrap()
      appendWaypoint(routeId, roundLngLat([lng, lat]))
    } else setSelection(undefined)
  }
  const onMoveStart = () => setMenu(undefined)
  const onKeyDown = (e: KeyboardEvent) => {
    // Text fields keep their own undo and Escape handling.
    if (isTextField(e.target)) return
    const key = e.key.toLowerCase()
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (key === 'z' || key === 'y')) {
      e.preventDefault()
      if (key === 'y' || e.shiftKey) redo()
      else undo()
      return
    }
    if (e.key !== 'Escape') return
    if (menu()) setMenu(undefined)
    else if (mode() === 'route') stopDrawing()
    else if (mode() === 'transform') stopTransform()
    else setSelection(undefined)
  }

  container.addEventListener('pointerdown', onPointerDown, true)
  map.on('contextmenu', onContextMenu)
  map.on('click', onClick)
  map.on('movestart', onMoveStart)
  document.addEventListener('keydown', onKeyDown)
  onCleanup(() => {
    container.removeEventListener('pointerdown', onPointerDown, true)
    map.off('contextmenu', onContextMenu)
    map.off('click', onClick)
    map.off('movestart', onMoveStart)
    document.removeEventListener('keydown', onKeyDown)
  })
  return null
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'reset', 'color'])

function isTextField(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type)
  return target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)
}
