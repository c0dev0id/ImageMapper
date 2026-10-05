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
