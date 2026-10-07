import type { Project } from './schema.ts'

interface Entry<T> {
  state: T
  label: string
}

/** Undo/redo stacks of states taken before each edit. */
export class History<T> {
  private past: Entry<T>[] = []
  private future: Entry<T>[] = []

  constructor(private readonly limit = 100) {}

  /** Records the state before an edit; a new edit discards what could be redone. */
  record(before: T, label: string): void {
    this.future = []
    this.past.push({ state: before, label })
    if (this.past.length > this.limit) this.past.shift()
  }

  /** Returns the state to go back to, or undefined if there is nothing to undo. */
  undo(current: T): T | undefined {
    const entry = this.past.pop()
    if (!entry) return undefined
    this.future.push({ state: current, label: entry.label })
    return entry.state
  }

  /** Returns the state to go forward to, or undefined if there is nothing to redo. */
  redo(current: T): T | undefined {
    const entry = this.future.pop()
    if (!entry) return undefined
    this.past.push({ state: current, label: entry.label })
    return entry.state
  }

  clear(): void {
    this.past = []
    this.future = []
  }

  get undoLabel(): string | undefined {
    return this.past.at(-1)?.label
  }

  get redoLabel(): string | undefined {
    return this.future.at(-1)?.label
  }
}

/**
 * A state from the history combined with the current display settings: the map view,
 * the base map, the satellite layer and each image layer's visibility, opacity and blend
 * mode are not undone.
 */
export function withCurrentDisplay(state: Project, current: Project): Project {
  const display = new Map(
    current.layers.map((l) => [l.id, { visible: l.visible, opacity: l.opacity, blend: l.blend ?? 'normal' }] as const),
  )
  return {
    ...state,
    view: current.view,
    baseMap: current.baseMap,
    satellite: current.satellite,
    layers: state.layers.map((l) => ({ ...l, ...display.get(l.id) })),
  }
}
