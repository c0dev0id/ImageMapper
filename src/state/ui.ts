import { createSignal } from 'solid-js'
import type { Side } from './schema.ts'

/** Transient UI state; never persisted. */
export type Mode = 'georef' | 'route'

export interface Selection {
  layerId: string
  gcpId: string
  side: Side
}

export interface Notice {
  id: number
  text: string
  action?: { label: string; run: () => void | Promise<void> }
}

export const [mode, setMode] = createSignal<Mode>('georef')
export const [editingRouteId, setEditingRouteId] = createSignal<string>()
export const [selection, setSelection] = createSignal<Selection>()
export const [notices, setNotices] = createSignal<Notice[]>([])

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

/** Result of the last "skew image to map" on a layer, shown in its panel row. */
export const [skewNote, setSkewNote] = createSignal<{
  layerId: string
  kind: 'error' | 'warning'
  text: string
}>()

/** Enters draw route mode for a route; georeferencing selection and menus are closed. */
export function startDrawing(routeId: string): void {
  setSelection(undefined)
  setMenu(undefined)
  setEditingRouteId(routeId)
  setMode('route')
}

export function stopDrawing(): void {
  setMenu(undefined)
  setEditingRouteId(undefined)
  setMode('georef')
}
