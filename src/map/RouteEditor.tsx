import { createEffect, createMemo, For, onCleanup, Show } from 'solid-js'
import { roundLngLat } from '../routing/legs.ts'
import { moveWaypoint, nameWaypoint, removeWaypoint, routeById } from '../state/project.ts'
import { editingRouteId, mode, setMenu, type MenuItem } from '../state/ui.ts'
import { useMap } from './context.ts'
import { onLongPress } from './longPress.ts'
import { MarkerHandle } from './markers.ts'

/** Draggable markers for the points of the route being drawn; only shown in draw route mode. */
export function RouteEditor() {
  const routeId = createMemo(() => (mode() === 'route' ? editingRouteId() : undefined))
  const keys = createMemo(
    () => {
      const id = routeId()
      return routeById(id)?.waypoints.map((w) => `${id}/${w.id}`) ?? []
    },
    [],
    { equals: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]) },
  )
  return (
    <For each={keys()}>
      {(key) => {
        const [routeId, waypointId] = key.split('/')
        return <WaypointMarker routeId={routeId} waypointId={waypointId} />
      }}
    </For>
  )
}

function WaypointMarker(props: { routeId: string; waypointId: string }) {
  const map = useMap()
  const { routeId, waypointId } = props
  const route = createMemo(() => routeById(routeId))
  const index = () => route()?.waypoints.findIndex((w) => w.id === waypointId) ?? -1
  const name = () => route()?.waypoints[index()]?.name

  const content = (
    <div class="route-point">
      <div class="waypoint" style={{ 'background-color': route()?.color }}>
        {index() + 1}
      </div>
      <Show when={name()}>{(text) => <span class="waypoint-name">{text()}</span>}</Show>
    </div>
  ) as HTMLElement
  const handle = new MarkerHandle(map, content, { className: 'waypoint-marker', draggable: true })
  createEffect(() => {
    const w = route()?.waypoints[index()]
    handle.setPosition(w && [w.lngLat[0], w.lngLat[1]])
  })
  handle.marker.on('dragend', () => {
    const { lng, lat } = handle.marker.getLngLat().wrap()
    moveWaypoint(routeId, waypointId, roundLngLat([lng, lat]))
  })
  // Draggable markers swallow the map's contextmenu event and its long press, so the
  // marker opens the menu itself: right-click for mice, a long press for touch and pens.
  const openMenu = (clientX: number, clientY: number, touch: boolean) => {
    const rect = map.getContainer().getBoundingClientRect()
    setMenu({ x: clientX - rect.left, y: clientY - rect.top, touch, items: pointMenu(routeId, waypointId, name()) })
  }
  let pointerType = 'mouse'
  handle.root.addEventListener('pointerdown', (e) => (pointerType = e.pointerType))
  handle.root.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Android also fires contextmenu on a long press; that one is handled below.
    if (pointerType === 'mouse') openMenu(e.clientX, e.clientY, false)
  })
  const stopLongPress = onLongPress(handle.root, (x, y) => openMenu(x, y, true))
  handle.marker.on('dragstart', () => setMenu(undefined))
  onCleanup(() => {
    stopLongPress()
    handle.remove()
  })
  return null
}

/** Asks for a waypoint name; undefined if cancelled or left empty. */
function askName(current: string | undefined): string | undefined {
  return prompt('Waypoint name', current ?? '')?.trim() || undefined
}

/** A route point can become a waypoint (a named point) and back, or be removed. */
function pointMenu(routeId: string, waypointId: string, name: string | undefined): MenuItem[] {
  const setName = (label: string) => () => {
    const next = askName(name)
    if (next) nameWaypoint(routeId, waypointId, next, label)
  }
  const remove: MenuItem = { label: 'Remove point', enabled: true, run: () => removeWaypoint(routeId, waypointId) }
  if (!name) return [{ label: 'Change to waypoint…', enabled: true, run: setName('Change to waypoint') }, remove]
  return [
    { label: 'Rename waypoint…', enabled: true, run: setName('Rename waypoint') },
    {
      label: 'Change to route point',
      enabled: true,
      run: () => nameWaypoint(routeId, waypointId, undefined, 'Change to route point'),
    },
    remove,
  ]
}
