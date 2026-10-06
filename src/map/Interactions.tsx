import type { MapMouseEvent } from 'maplibre-gl'
import { createEffect, onCleanup } from 'solid-js'
import { roundLngLat } from '../routing/legs.ts'
import { appendPoint, redo, undo } from '../state/project.ts'
import {
  cancelTapRequest,
  deliverTap,
  editingRouteId,
  menu,
  mode,
  setMenu,
  setSelection,
  setTool,
  setWaypointDraft,
  stopDrawing,
  stopTransform,
  tapRequest,
  tool,
} from '../state/ui.ts'
import { useMap } from './context.ts'
import { openGcpMenu, startPin } from './gcpMenu.ts'
import { insertPointOnLine } from './routeTools.ts'
import { fromMarker } from './markers.ts'

/** Mouse and keyboard handling on the map that depends on the current mode. */
export function Interactions() {
  const map = useMap()

  // What the next tap does, and the mode, for the cursor over the map and for the markers (styles.css).
  createEffect(() => {
    const next = tapRequest() ? 'tap' : tool()
    if (next) map.getContainer().dataset.tool = next
    else delete map.getContainer().dataset.tool
  })
  createEffect(() => {
    map.getContainer().dataset.mode = mode()
  })

  // MapLibre turns a touch held for 500 ms into a contextmenu event. The browser may still
  // send a click when that finger lifts; it must neither close the menu nor add a point.
  // A press that closes an open menu only closes it: its click neither clears the
  // selection (a point waiting for its match) nor adds a route point.
  let pointerType = 'mouse'
  let swallowClick = false
  const onPointerDown = (e: PointerEvent) => {
    pointerType = e.pointerType
    swallowClick = menu() !== undefined && !(e.target instanceof Element && e.target.closest('.context-menu'))
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
    const { lng, lat } = e.lngLat.wrap()
    // A requested tap comes before the tools; markers let it through meanwhile (styles.css).
    if (deliverTap([lng, lat]) || fromMarker(e.originalEvent)) return
    setMenu(undefined)
    const routeId = editingRouteId()
    const t = tool()
    if (mode() === 'route' && routeId) {
      if (t === 'insert') insertPointOnLine(map, routeId, [e.point.x, e.point.y], pointerType === 'mouse' ? 10 : 24)
      else if (t === 'waypoint') setWaypointDraft({ lngLat: roundLngLat([lng, lat]), name: '', description: '' })
      else if (t === 'append' || t === undefined) appendPoint(routeId, roundLngLat([lng, lat]))
    } else if (t === 'pin') startPin(e.lngLat)
    else setSelection(undefined)
  }
  const onMoveStart = () => setMenu(undefined)
  const onKeyDown = (e: KeyboardEvent) => {
    // Keys a dialog has handled are done; text fields keep their own undo and Escape handling.
    if (e.defaultPrevented || isTextField(e.target)) return
    const key = e.key.toLowerCase()
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (key === 'z' || key === 'y')) {
      e.preventDefault()
      if (key === 'y' || e.shiftKey) redo()
      else undo()
      return
    }
    if (e.key !== 'Escape') return
    if (tapRequest()) cancelTapRequest()
    else if (menu()) setMenu(undefined)
    else if (mode() === 'route') {
      // The other route tools fall back to appending; Esc while appending ends drawing.
      if (tool() !== 'append') setTool('append')
      else stopDrawing()
    }
    else if (mode() === 'transform') stopTransform()
    else if (tool()) setTool(undefined)
    else setSelection(undefined)
  }

  // On the window, so it runs before the menu closes itself on the same press.
  window.addEventListener('pointerdown', onPointerDown, true)
  map.on('contextmenu', onContextMenu)
  map.on('click', onClick)
  map.on('movestart', onMoveStart)
  document.addEventListener('keydown', onKeyDown)
  onCleanup(() => {
    window.removeEventListener('pointerdown', onPointerDown, true)
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
