import { describe, expect, it } from 'vitest'
import { History, withCurrentDisplay } from './history.ts'
import { emptyProject, type ImageLayer, type Project } from './schema.ts'

describe('History', () => {
  it('undoes and redoes in order', () => {
    const history = new History<number>()
    history.record(0, 'one')
    history.record(1, 'two')
    expect(history.undoLabel).toBe('two')
    expect(history.undo(2)).toBe(1)
    expect(history.undo(1)).toBe(0)
    expect(history.undo(0)).toBeUndefined()
    expect(history.redoLabel).toBe('one')
    expect(history.redo(0)).toBe(1)
    expect(history.redo(1)).toBe(2)
    expect(history.redo(2)).toBeUndefined()
    expect(history.undoLabel).toBe('two')
  })

  it('drops the redo stack when a new edit is recorded', () => {
    const history = new History<number>()
    history.record(0, 'one')
    history.undo(1)
    history.record(0, 'other')
    expect(history.redoLabel).toBeUndefined()
    expect(history.undo(5)).toBe(0)
  })

  it('keeps at most the configured number of steps', () => {
    const history = new History<number>(2)
    history.record(0, 'a')
    history.record(1, 'b')
    history.record(2, 'c')
    expect(history.undo(3)).toBe(2)
    expect(history.undo(2)).toBe(1)
    expect(history.undo(1)).toBeUndefined()
  })

  it('can be cleared', () => {
    const history = new History<number>()
    history.record(0, 'a')
    history.undo(1)
    history.clear()
    expect(history.undoLabel).toBeUndefined()
    expect(history.redoLabel).toBeUndefined()
  })
})

describe('withCurrentDisplay', () => {
  const layer = (id: string, visible: boolean, opacity: number): ImageLayer => ({
    id,
    name: id,
    mime: 'image/jpeg',
    width: 1,
    height: 1,
    visible,
    opacity,
    placement: [],
    gcps: [],
  })

  it('keeps the current view, base map, satellite and layer display settings', () => {
    const state: Project = {
      ...emptyProject(),
      name: 'old',
      layers: [layer('a', true, 1), layer('deleted', true, 1)],
    }
    const current: Project = {
      ...emptyProject(),
      name: 'new',
      view: { center: [11, 48], zoom: 12, bearing: 30, pitch: 40 },
      baseMap: 'osm',
      satellite: { visible: true, opacity: 0.4 },
      layers: [{ ...layer('a', false, 0.3), blend: 'multiply' }],
    }
    const merged = withCurrentDisplay(state, current)
    expect(merged.name).toBe('old')
    expect(merged.view).toEqual(current.view)
    expect(merged.baseMap).toBe('osm')
    expect(merged.satellite).toEqual(current.satellite)
    expect(merged.layers.map((l) => [l.id, l.visible, l.opacity, l.blend])).toEqual([
      ['a', false, 0.3, 'multiply'],
      ['deleted', true, 1, undefined],
    ])
  })
})
