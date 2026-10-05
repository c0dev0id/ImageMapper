import { createSignal } from 'solid-js'
import { createStore, reconcile, unwrap } from 'solid-js/store'
import type { LngLat, Pair } from '../geo/types.ts'
import * as edit from '../routing/routeEdit.ts'
import { History, withCurrentDisplay } from './history.ts'
import {
  emptyProject,
  type Gcp,
  type ImageLayer,
  type Profile,
  type Project,
  type Route,
  type View,
} from './schema.ts'
import {
  editingRouteId,
  setEditingRouteId,
  setMenu,
  setMode,
  setSelection,
  setSkewNote,
  stopDrawing,
} from './ui.ts'

/**
 * The project store. All writes go through the actions below so that every change is
 * reported to persistence and results of pure functions are applied with `reconcile`
 * (a plain object set merges and would keep stale keys).
 */
const [project, setProject] = createStore<Project>(emptyProject())
export { project }

let onChange: () => void = () => {}

/** Registers the callback that is told about every project change (autosave). */
export function setChangeListener(listener: () => void): void {
  onChange = listener
}

export function serializeProject(): string {
  return JSON.stringify(unwrap(project))
}

/**
 * Undo history of content edits. Display settings (map view, satellite, layer visibility
 * and opacity), routing results and the active-layer switch are not recorded.
 */
const history = new History<Project>()
const [historyVersion, setHistoryVersion] = createSignal(0)

const snapshot = (): Project => structuredClone(unwrap(project))

/** Records the current project as an undo step; call right before a content edit. */
function recordEdit(label: string): void {
  history.record(snapshot(), label)
  setHistoryVersion((v) => v + 1)
}

/** Label of the edit that undo would revert (reactive). */
export function undoLabel(): string | undefined {
  historyVersion()
  return history.undoLabel
}

/** Label of the edit that redo would repeat (reactive). */
export function redoLabel(): string | undefined {
  historyVersion()
  return history.redoLabel
}

export function undo(): void {
  restore(history.undo(snapshot()))
}

export function redo(): void {
  restore(history.redo(snapshot()))
}

function restore(state: Project | undefined): void {
  if (!state) return
  setSelection(undefined)
  setMenu(undefined)
  setSkewNote(undefined)
  setProject(reconcile(withCurrentDisplay(state, unwrap(project)), { key: 'id', merge: false }))
  const routeId = editingRouteId()
  if (routeId && !routeById(routeId)) stopDrawing()
  setHistoryVersion((v) => v + 1)
  onChange()
}

function layerIndex(id: string): number {
  return project.layers.findIndex((l) => l.id === id)
}

export function layerById(id: string | undefined): ImageLayer | undefined {
  return id === undefined ? undefined : project.layers.find((l) => l.id === id)
}

export function activeLayer(): ImageLayer | undefined {
  return layerById(project.activeLayerId)
}

/** Replaces the whole project (open, new, startup) and resets the transient UI state. */
export function replaceProject(next: Project): void {
  setSelection(undefined)
  setEditingRouteId(undefined)
  setMode('georef')
  setMenu(undefined)
  setSkewNote(undefined)
  setProject(reconcile(next, { key: 'id', merge: false }))
  history.clear()
  setHistoryVersion((v) => v + 1)
  onChange()
}

export function setProjectName(name: string): void {
  if (name === project.name) return
  recordEdit('Rename project')
  setProject('name', name)
  onChange()
}

export function setView(view: View): void {
  setProject('view', reconcile(view))
  onChange()
}

export function setSatellite(patch: Partial<Project['satellite']>): void {
  setProject('satellite', (s) => ({ ...s, ...patch }))
  onChange()
}

/** Adds an image layer on top and makes it the active layer. */
export function addLayer(layer: ImageLayer): void {
  recordEdit('Add image')
  setProject('layers', (layers) => [...layers, layer])
  setActiveLayer(layer.id)
}

export function removeLayer(id: string): void {
  const index = layerIndex(id)
  if (index < 0) return
  recordEdit('Delete layer')
  if (project.activeLayerId === id) {
    const neighbour = project.layers[index + 1] ?? project.layers[index - 1]
    setActiveLayer(neighbour?.id)
  }
  setProject('layers', (layers) => layers.filter((l) => l.id !== id))
  onChange()
}

/** Moves a layer up (+1, towards the top) or down (-1) in the stack. */
export function moveLayer(id: string, delta: 1 | -1): void {
  const from = layerIndex(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= project.layers.length) return
  recordEdit('Reorder layers')
  setProject('layers', (layers) => {
    const next = [...layers]
    const [layer] = next.splice(from, 1)
    next.splice(to, 0, layer)
    return next
  })
  onChange()
}

export function setActiveLayer(id: string | undefined): void {
  if (project.activeLayerId === id) return
  setSelection(undefined)
  setMenu(undefined)
  setProject('activeLayerId', id)
  onChange()
}

export function setLayerVisible(id: string, visible: boolean): void {
  const index = layerIndex(id)
  if (index < 0) return
  setProject('layers', index, 'visible', visible)
  onChange()
}

export function setLayerOpacity(id: string, opacity: number): void {
  const index = layerIndex(id)
  if (index < 0) return
  setProject('layers', index, 'opacity', opacity)
  onChange()
}

export function setLayerPlacement(id: string, placement: Pair[]): void {
  const index = layerIndex(id)
  if (index < 0) return
  recordEdit('Skew image to map')
  setProject('layers', index, 'placement', placement)
  onChange()
}

export function setLayerGcps(id: string, gcps: Gcp[], label: string): void {
  const index = layerIndex(id)
  if (index < 0) return
  recordEdit(label)
  setProject('layers', index, 'gcps', reconcile(gcps, { key: 'id', merge: false }))
  onChange()
}

export function routeById(id: string | undefined): Route | undefined {
  return id === undefined ? undefined : project.routes.find((r) => r.id === id)
}

export function addRoute(route: Route): void {
  recordEdit('Draw route')
  setProject('routes', (routes) => [...routes, route])
  onChange()
}

export function removeRoute(id: string): void {
  if (!routeById(id)) return
  recordEdit('Delete route')
  setProject('routes', (routes) => routes.filter((r) => r.id !== id))
  onChange()
}

export function renameRoute(id: string, name: string): void {
  const index = project.routes.findIndex((r) => r.id === id)
  if (index < 0 || project.routes[index].name === name) return
  recordEdit('Rename route')
  setProject('routes', index, 'name', name)
  onChange()
}

/**
 * Applies a pure edit to a route; reconciling by id keeps unchanged waypoints' identity.
 * Edits with a label are undo steps; routing results come without one.
 */
function updateRoute(id: string, change: (route: Route) => Route, label?: string): void {
  const index = project.routes.findIndex((r) => r.id === id)
  if (index < 0) return
  const current = unwrap(project.routes[index])
  const next = change(current)
  if (next === current) return
  if (label) recordEdit(label)
  setProject('routes', index, reconcile(next, { key: 'id', merge: false }))
  onChange()
}

export function setRouteProfile(id: string, profile: Profile): void {
  updateRoute(id, (r) => (r.profile === profile ? r : edit.changeProfile(r, profile)), 'Change routing profile')
}

export function appendWaypoint(routeId: string, lngLat: LngLat): void {
  updateRoute(routeId, (r) => edit.appendWaypoint(r, { id: crypto.randomUUID(), lngLat }), 'Add point')
}

export function moveWaypoint(routeId: string, waypointId: string, lngLat: LngLat): void {
  updateRoute(routeId, (r) => edit.moveWaypoint(r, waypointId, lngLat), 'Move point')
}

export function removeWaypoint(routeId: string, waypointId: string): void {
  updateRoute(routeId, (r) => edit.removeWaypoint(r, waypointId), 'Remove point')
}

export function setRouteLeg(routeId: string, key: string, geometry: string): void {
  updateRoute(routeId, (r) => edit.addLeg(r, key, geometry))
}
