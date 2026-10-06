import { createEffect, createMemo, For, onCleanup } from 'solid-js'
import { project } from '../state/project.ts'
import { useMap } from './context.ts'
import { MarkerHandle } from './markers.ts'
import { WaypointPin } from '../ui/icons.tsx'

/** Waypoints: always shown as a pin with the name; they let clicks through to the map. */
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
  const waypoint = () => project.waypoints.find((w) => w.id === props.id)
  const content = (
    <div class="waypoint" title={waypoint()?.description ?? ''}>
      <WaypointPin />
      <span class="waypoint-name">{waypoint()?.name}</span>
    </div>
  ) as HTMLElement
  const handle = new MarkerHandle(map, content, { className: 'waypoint-marker', anchor: 'bottom' })
  createEffect(() => {
    const w = waypoint()
    handle.setPosition(w && [w.lngLat[0], w.lngLat[1]])
  })
  onCleanup(() => handle.remove())
  return null
}
