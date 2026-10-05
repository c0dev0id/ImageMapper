import { createStore, reconcile, unwrap } from 'solid-js/store'
import type { Pair } from '../geo/types.ts'
import { emptyProject, type Gcp, type ImageLayer, type Project, type View } from './schema.ts'
import { setEditingRouteId, setMode, setSelection } from './ui.ts'

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
  setProject(reconcile(next, { key: 'id', merge: false }))
  onChange()
}

export function setProjectName(name: string): void {
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
  setProject('layers', (layers) => [...layers, layer])
  setActiveLayer(layer.id)
}

export function removeLayer(id: string): void {
  const index = layerIndex(id)
  if (index < 0) return
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
  setProject('layers', index, 'placement', placement)
  onChange()
}

export function setLayerGcps(id: string, gcps: Gcp[]): void {
  const index = layerIndex(id)
  if (index < 0) return
  setProject('layers', index, 'gcps', reconcile(gcps, { key: 'id', merge: false }))
  onChange()
}
