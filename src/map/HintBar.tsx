import { Match, Switch } from 'solid-js'
import { gcpNumber } from '../gcp/gcps.ts'
import { activeLayer, routeById } from '../state/project.ts'
import { editingRouteId, mode, selection, stopDrawing, stopTransform, tool, type Tool } from '../state/ui.ts'

const ROUTE_HINTS: Partial<Record<Tool, string>> = {
  append: 'tap the map to add points at the end, drag points to move them.',
  insert: 'tap the route line to insert a point there.',
  waypoint: 'tap the map to place a waypoint; right-click or long-press one to edit it.',
  delete: 'tap a route point or a waypoint to delete it.',
}

/** A short instruction for the current state, shown over the map. */
export function HintBar() {
  const text = () => {
    if (mode() !== 'georef') return undefined
    const layer = activeLayer()
    if (!layer) return undefined
    const sel = selection()
    const t = tool()
    if (sel && sel.layerId === layer.id) {
      const n = gcpNumber(layer.gcps, sel.gcpId)
      const other = sel.side === 'image' ? 'map' : 'image'
      const how = t ? 'tap' : 'pin, right-click or long-press'
      return `${sel.side === 'image' ? 'Image' : 'Map'} point ${n} selected: ${how} the same place on the ${other}.`
    }
    if (t === 'pin-map') return 'Tap a feature on the map to pin it, then the same feature on the image.'
    if (t === 'pin-image') return 'Tap a feature on the image to pin it, then the same feature on the map.'
    return 'Pin a feature on the image and the same feature on the map; skew with 3 or more pairs.'
  }
  const drawing = () => (mode() === 'route' ? routeById(editingRouteId()) : undefined)
  return (
    <Switch>
      <Match when={drawing()}>
        {(route) => (
          <div class="hint-bar interactive">
            <strong>{route().name}</strong>: {ROUTE_HINTS[tool() ?? 'append']}{' '}
            <button class="primary" onClick={stopDrawing}>
              Done
            </button>
          </div>
        )}
      </Match>
      <Match when={mode() === 'transform'}>
        <div class="hint-bar interactive">
          Drag the image to move it, a corner to resize it, the round handle to rotate it.{' '}
          <button class="primary" onClick={stopTransform}>
            Done
          </button>
        </div>
      </Match>
      <Match when={text()}>
        <div class="hint-bar">{text()}</div>
      </Match>
    </Switch>
  )
}
