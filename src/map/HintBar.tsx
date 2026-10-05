import { Show } from 'solid-js'
import { gcpNumber } from '../gcp/gcps.ts'
import { activeLayer, routeById } from '../state/project.ts'
import { editingRouteId, mode, selection, stopDrawing } from '../state/ui.ts'

/** A short instruction for the current state, shown over the map. */
export function HintBar() {
  const text = () => {
    if (mode() !== 'georef') return undefined
    const layer = activeLayer()
    if (!layer) return undefined
    const sel = selection()
    if (sel && sel.layerId === layer.id) {
      const n = gcpNumber(layer.gcps, sel.gcpId)
      return sel.side === 'image'
        ? `Image point ${n} selected: right-click or long-press the same place on the map and choose "Match point on map".`
        : `Map point ${n} selected: right-click or long-press the same place on the image and choose "Match point on image".`
    }
    return 'Right-click or long-press a feature on the image, then the same feature on the map. Skew the image with 3 or more pairs.'
  }
  const drawing = () => (mode() === 'route' ? routeById(editingRouteId()) : undefined)
  return (
    <Show
      when={drawing()}
      fallback={
        <Show when={text()}>
          <div class="hint-bar">{text()}</div>
        </Show>
      }
    >
      {(route) => (
        <div class="hint-bar interactive">
          <strong>{route().name}</strong>: click to add points, drag to move them, right-click or
          long-press a point to remove it.{' '}
          <button class="primary" onClick={stopDrawing}>
            Done
          </button>
        </div>
      )}
    </Show>
  )
}
