import { createSignal } from 'solid-js'
import type { LngLat, Px } from '../geo/types.ts'

/**
 * Transient UI state; never persisted. Modes: marking point pairs (`georef`), drawing a
 * route (`route`) and moving/rotating/resizing the active image (`transform`).
 */
export type Mode = 'georef' | 'route' | 'transform'

export interface Notice {
  id: number
  text: string
  /** A button for the notice; `confirm` is asked first, for actions that cannot be undone. */
  action?: { label: string; run: () => void | Promise<void>; confirm?: string }
}

/**
 * Map tools picked in the toolbar: pinning point pairs on the active image, and adding,
 * inserting or deleting while a route is drawn. Without a tool the map only navigates.
 */
export type Tool = 'pin' | 'append' | 'insert' | 'waypoint' | 'delete'

/**
 * The image point of a pair being pinned, while it waits for its place on the map. It
 * only becomes a point pair together with that place, so dropping it leaves nothing.
 */
export const [pendingPin, setPendingPin] = createSignal<{ layerId: string; image: Px }>()

export const [mode, setMode] = createSignal<Mode>('georef')
export const [tool, setTool] = createSignal<Tool>()
export const [editingRouteId, setEditingRouteId] = createSignal<string>()
export const [notices, setNotices] = createSignal<Notice[]>([])
/** On phones the panel can shrink to its title row to give the map more room. */
export const [panelCollapsed, setPanelCollapsed] = createSignal(false)

let nextNoticeId = 1

export function notify(text: string, action?: Notice['action']): void {
  setNotices((list) => [...list, { id: nextNoticeId++, text, action }])
}

export function dismissNotice(id: number): void {
  setNotices((list) => list.filter((n) => n.id !== id))
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export interface MenuItem {
  label: string
  enabled: boolean
  run: () => void
}

/**
 * The open context menu, positioned in CSS pixels relative to the map container. A menu
 * opened by a long press (`touch`) ignores the lifting finger until it is tapped again.
 */
export const [menu, setMenu] = createSignal<{ x: number; y: number; touch: boolean; items: MenuItem[] }>()

/** A waypoint being created (no id) or edited in the waypoint dialog. */
export interface WaypointDraft {
  id?: string
  lngLat: LngLat
  name: string
  description: string
}

export const [waypointDraft, setWaypointDraft] = createSignal<WaypointDraft>()

/**
 * A request for one tap on the map, such as picking where a town is on the image:
 * the next tap goes to `onTap` instead of the tools and markers, and the hint bar shows
 * `hint`. Esc, the hint bar's Cancel, a mode change, a tool pick or another request end it
 * without a tap.
 */
export interface TapRequest {
  hint: string
  /** Gets the tapped place; false keeps the request open for another tap. */
  onTap: (lngLat: LngLat) => boolean | void
  onCancel?: () => void
}

const [tapRequest, setTapRequest] = createSignal<TapRequest>()
export { tapRequest }

/** Opens a tap request, ending the one before. */
export function requestTap(request: TapRequest): void {
  cancelTapRequest()
  setTapRequest(request)
}

export function cancelTapRequest(): void {
  const request = tapRequest()
  setTapRequest(undefined)
  request?.onCancel?.()
}

/** Hands a tap on the map to the open request; false when there is none. */
export function deliverTap(lngLat: LngLat): boolean {
  const request = tapRequest()
  if (!request) return false
  if (request.onTap(lngLat) !== false && tapRequest() === request) setTapRequest(undefined)
  return true
}

/** Outcome of the last skew or town match on a layer, shown below the layer's settings. */
export const [layerNote, setLayerNote] = createSignal<{
  layerId: string
  kind: 'error' | 'warning' | 'info'
  text: string
}>()

/** Enters draw route mode for a route; a waiting tap request and an open menu are closed. */
export function startDrawing(routeId: string): void {
  cancelTapRequest()
  setMenu(undefined)
  setEditingRouteId(routeId)
  setMode('route')
  setTool('append')
}

export function stopDrawing(): void {
  cancelTapRequest()
  setMenu(undefined)
  setEditingRouteId(undefined)
  setMode('georef')
  setTool(undefined)
}

/** Enters the move/rotate/resize mode for the active image layer. */
export function startTransform(): void {
  cancelTapRequest()
  setMenu(undefined)
  setEditingRouteId(undefined)
  setMode('transform')
  setTool(undefined)
}

export function stopTransform(): void {
  cancelTapRequest()
  if (mode() === 'transform') setMode('georef')
}
