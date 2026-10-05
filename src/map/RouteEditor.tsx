import { createEffect, createMemo, For, onCleanup } from 'solid-js'
import { roundLngLat } from '../routing/legs.ts'
import { moveWaypoint, removeWaypoint, routeById } from '../state/project.ts'
import { editingRouteId, mode, setMenu } from '../state/ui.ts'
import { useMap } from './context.ts'
import { onLongPress } from './longPress.ts'
import { MarkerHandle } from './markers.ts'

/** Draggable waypoint markers of the route being drawn; only shown in draw route mode. */
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

  const content = (
    <div class="waypoint" style={{ 'background-color': route()?.color }}>
      {index() + 1}
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
    setMenu({
      x: clientX - rect.left,
      y: clientY - rect.top,
      touch,
      items: [{ label: 'Remove point', enabled: true, run: () => removeWaypoint(routeId, waypointId) }],
    })
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
