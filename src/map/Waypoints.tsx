import { createEffect, createMemo, For, onCleanup } from 'solid-js'
import { roundLngLat } from '../routing/legs.ts'
import { project, removeWaypoint, updateWaypoint } from '../state/project.ts'
import { mode, setMenu, setWaypointDraft, tool } from '../state/ui.ts'
import { WaypointPin } from '../ui/icons.tsx'
import { useMap } from './context.ts'
import { MarkerHandle, onMarkerMenu } from './markers.ts'

/**
 * Waypoints: always shown as a pin with the name. While a route is drawn they can be
 * dragged, edited or deleted; otherwise they let clicks through to the map.
 */
export function Waypoints() {
  const ids = createMemo(
    () => project.waypoints.map((w) => w.id),
    [],
    { equals: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]) },
  )
  return <For each={ids()}>{(id) => <WaypointMarker id={id} />}</For>
}

function WaypointMarker(props: { id: string }) {
  const map = useMap()
  const id = props.id
  const waypoint = () => project.waypoints.find((w) => w.id === id)
  const editable = () => mode() === 'route'

  const content = (
    <div class="waypoint" title={waypoint()?.description ?? ''}>
      <WaypointPin />
      <span class="waypoint-name">{waypoint()?.name}</span>
    </div>
  ) as HTMLElement
  const handle = new MarkerHandle(map, content, { className: 'waypoint-marker', anchor: 'bottom', draggable: true })
  createEffect(() => {
    const w = waypoint()
    handle.setPosition(w && [w.lngLat[0], w.lngLat[1]])
  })
  // Inline, since MapLibre sets pointer-events on a marker after dragging it.
  createEffect(() => {
    handle.marker.setDraggable(editable())
    handle.root.style.pointerEvents = editable() ? 'auto' : 'none'
  })
  handle.marker.on('dragend', () => {
    const { lng, lat } = handle.marker.getLngLat().wrap()
    updateWaypoint(id, { lngLat: roundLngLat([lng, lat]) }, 'Move waypoint')
  })
  handle.root.addEventListener('click', () => {
    if (editable() && tool() === 'delete') removeWaypoint(id)
  })
  const stopMenu = onMarkerMenu(handle, (clientX, clientY, touch) => {
    const w = waypoint()
    if (!editable() || !w) return
    const rect = map.getContainer().getBoundingClientRect()
    setMenu({
      x: clientX - rect.left,
      y: clientY - rect.top,
      touch,
      items: [
        {
          label: 'Edit waypoint…',
          enabled: true,
          run: () => setWaypointDraft({ id, lngLat: w.lngLat, name: w.name, description: w.description ?? '' }),
        },
        { label: 'Delete waypoint', enabled: true, run: () => removeWaypoint(id) },
      ],
    })
  })
  onCleanup(() => {
    stopMenu()
    handle.remove()
  })
  return null
}
