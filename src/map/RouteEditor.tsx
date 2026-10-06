import { createEffect, createMemo, For, onCleanup } from 'solid-js'
import { roundLngLat } from '../routing/legs.ts'
import { movePoint, removePoint, routeById } from '../state/project.ts'
import { editingRouteId, mode, setMenu } from '../state/ui.ts'
import { useMap } from './context.ts'
import { MarkerHandle, onMarkerMenu } from './markers.ts'

/** Draggable markers for the points of the route being drawn; only shown in draw route mode. */
export function RouteEditor() {
  const routeId = createMemo(() => (mode() === 'route' ? editingRouteId() : undefined))
  const keys = createMemo(
    () => {
      const id = routeId()
      return routeById(id)?.points.map((p) => `${id}/${p.id}`) ?? []
    },
    [],
    { equals: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]) },
  )
  return (
    <For each={keys()}>
      {(key) => {
        const [routeId, pointId] = key.split('/')
        return <PointMarker routeId={routeId} pointId={pointId} />
      }}
    </For>
  )
}

function PointMarker(props: { routeId: string; pointId: string }) {
  const map = useMap()
  const { routeId, pointId } = props
  const route = createMemo(() => routeById(routeId))
  const index = () => route()?.points.findIndex((p) => p.id === pointId) ?? -1

  const content = (
    <div class="route-point" style={{ 'background-color': route()?.color }}>
      {index() + 1}
    </div>
  ) as HTMLElement
  const handle = new MarkerHandle(map, content, { className: 'route-point-marker', draggable: true })
  createEffect(() => {
    const p = route()?.points[index()]
    handle.setPosition(p && [p.lngLat[0], p.lngLat[1]])
  })
  handle.marker.on('dragend', () => {
    const { lng, lat } = handle.marker.getLngLat().wrap()
    movePoint(routeId, pointId, roundLngLat([lng, lat]))
  })
  const stopMenu = onMarkerMenu(handle, (clientX, clientY, touch) => {
    const rect = map.getContainer().getBoundingClientRect()
    setMenu({
      x: clientX - rect.left,
      y: clientY - rect.top,
      touch,
      items: [{ label: 'Remove point', enabled: true, run: () => removePoint(routeId, pointId) }],
    })
  })
  onCleanup(() => {
    stopMenu()
    handle.remove()
  })
  return null
}
