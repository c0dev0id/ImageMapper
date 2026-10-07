import { Match, Switch } from 'solid-js'
import { activeLayer, routeById } from '../state/project.ts'
import {
  cancelTapRequest,
  editingRouteId,
  mode,
  stopDrawing,
  stopTransform,
  tapRequest,
  tool,
  type Tool,
} from '../state/ui.ts'

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
    if (tool() === 'pin') {
      return layer.visible
        ? 'Tap a spot on the image to pin it, then its place on the map.'
        : 'The image is hidden: show it to pin a spot on it.'
    }
    return 'Pin a spot on the image and its place on the map; skew with 3 or more pairs.'
  }
  const drawing = () => (mode() === 'route' ? routeById(editingRouteId()) : undefined)
  return (
    <Switch>
      <Match when={tapRequest()}>
        {(request) => (
          <div class="hint-bar interactive">
            {request().hint}{' '}
            <button onClick={cancelTapRequest}>Cancel</button>
          </div>
        )}
      </Match>
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
