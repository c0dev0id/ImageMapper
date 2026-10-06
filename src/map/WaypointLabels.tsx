import { createEffect, createMemo, For, onCleanup } from 'solid-js'
import { project, routeById } from '../state/project.ts'
import { editingRouteId, mode } from '../state/ui.ts'
import { useMap } from './context.ts'
import { MarkerHandle } from './markers.ts'

/**
 * Waypoints (named route points) of all routes, shown as a dot with the name. They take
 * no pointer events; the route being drawn shows its points in the editor instead.
 */
export function WaypointLabels() {
  const keys = createMemo(
    () => {
      const editing = mode() === 'route' ? editingRouteId() : undefined
      const out: string[] = []
      for (const route of project.routes) {
        if (route.id === editing) continue
        for (const w of route.waypoints) if (w.name) out.push(`${route.id}/${w.id}`)
      }
      return out
    },
    [],
    { equals: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]) },
  )
  return (
    <For each={keys()}>
      {(key) => {
        const [routeId, waypointId] = key.split('/')
        return <WaypointLabel routeId={routeId} waypointId={waypointId} />
      }}
    </For>
  )
}

function WaypointLabel(props: { routeId: string; waypointId: string }) {
  const map = useMap()
  const { routeId, waypointId } = props
  const route = createMemo(() => routeById(routeId))
  const waypoint = () => route()?.waypoints.find((w) => w.id === waypointId)

  const content = (
    <div class="waypoint-label">
      <div class="waypoint-dot" style={{ 'background-color': route()?.color }} />
      <span class="waypoint-name">{waypoint()?.name}</span>
    </div>
  ) as HTMLElement
  const handle = new MarkerHandle(map, content, { className: 'waypoint-label-marker' })
  createEffect(() => {
    const w = waypoint()
    handle.setPosition(w && [w.lngLat[0], w.lngLat[1]])
  })
  onCleanup(() => handle.remove())
  return null
}
