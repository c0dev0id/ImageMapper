import { For, Show } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { namedPoints, routeTracks, toGpx } from '../export/gpx.ts'
import { decodePolyline } from '../routing/polyline.ts'
import { useMapAccessor } from '../map/context.ts'
import { flyToRoute } from '../map/navigate.ts'
import { nextRouteColor } from '../routing/routeEdit.ts'
import { failedLegs, lastError, pendingLegs, retryFailedLegs } from '../routing/service.ts'
import { addRoute, project, removeRoute, renameRoute, setRouteProfile } from '../state/project.ts'
import type { Profile, Route } from '../state/schema.ts'
import { editingRouteId, startDrawing, stopDrawing } from '../state/ui.ts'
import { downloadBlob, fileBaseName } from './download.ts'
import { EditableName } from './EditableName.tsx'
import { CrosshairIcon } from './icons.tsx'

const PROFILES: { value: Profile; label: string }[] = [
  { value: 'car', label: 'Car' },
  { value: 'bike', label: 'Bike' },
  { value: 'foot', label: 'Foot' },
]

function drawNewRoute() {
  const id = crypto.randomUUID()
  addRoute({
    id,
    name: `Route ${project.routes.length + 1}`,
    profile: project.routes.at(-1)?.profile ?? 'car',
    color: nextRouteColor(project.routes),
    waypoints: [],
    legs: {},
  })
  startDrawing(id)
}

function exportGpx() {
  const unrouted = pendingLegs() + failedLegs().size
  if (
    unrouted > 0 &&
    !confirm(`${unrouted} ${unrouted === 1 ? 'leg is' : 'legs are'} not routed and will be exported as straight lines. Export anyway?`)
  ) {
    return
  }
  const routes = unwrap(project.routes)
  const tracks = routeTracks(routes, (geometry) => decodePolyline(geometry))
  const gpx = toGpx(project.name, namedPoints(routes), tracks, new Date())
  downloadBlob(new Blob([gpx], { type: 'application/gpx+xml' }), `${fileBaseName(project.name)}.gpx`)
}

export function RoutesSection() {
  const exportable = () => project.routes.some((r) => r.waypoints.length >= 2 || r.waypoints.some((w) => w.name))
  return (
    <section class="section">
      <div class="row">
        <h2 class="grow">Routes</h2>
        <button onClick={drawNewRoute}>Draw route</button>
      </div>
      <Show when={project.routes.length === 0}>
        <p class="muted hint">Trace the tour on the map; each route becomes a track in the GPX export.</p>
      </Show>
      <ul class="routes">
        <For each={project.routes}>{(route) => <RouteRow route={route} />}</For>
      </ul>
      <Show when={pendingLegs() > 0}>
        <p class="muted hint">Routing… {pendingLegs()} {pendingLegs() === 1 ? 'leg' : 'legs'} left</p>
      </Show>
      <Show when={failedLegs().size > 0}>
        <div class="note error">
          Routing failed for {failedLegs().size} {failedLegs().size === 1 ? 'leg' : 'legs'}
          {lastError() ? `: ${lastError()}` : '.'}{' '}
          <button onClick={retryFailedLegs}>Retry routing</button>
        </div>
      </Show>
      <div class="row end">
        <button disabled={!exportable()} onClick={exportGpx}>
          Export GPX
        </button>
      </div>
    </section>
  )
}

function RouteRow(props: { route: Route }) {
  const route = props.route
  const map = useMapAccessor()
  const editing = () => editingRouteId() === route.id
  const named = () => route.waypoints.filter((w) => w.name).length
  return (
    <li class="route" classList={{ active: editing() }}>
      <div class="row">
        <span class="swatch" style={{ 'background-color': route.color }} />
        <EditableName value={route.name} label="route" onRename={(name) => renameRoute(route.id, name)} />
        <button
          class="icon"
          title="Fly to route"
          aria-label="Fly to route"
          disabled={!map() || route.waypoints.length === 0}
          onClick={() => {
            const m = map()
            if (m) flyToRoute(m, route)
          }}
        >
          <CrosshairIcon />
        </button>
        <button
          class="icon"
          title="Delete route"
          onClick={() => {
            if (editing()) stopDrawing()
            removeRoute(route.id)
          }}
        >
          ×
        </button>
      </div>
      <div class="row">
        <span class="grow muted">
          {route.waypoints.length} {route.waypoints.length === 1 ? 'point' : 'points'}
          {named() > 0 ? `, ${named()} ${named() === 1 ? 'waypoint' : 'waypoints'}` : ''}
        </span>
        <select
          aria-label="Routing profile"
          value={route.profile}
          onChange={(e) => setRouteProfile(route.id, e.currentTarget.value as Profile)}
        >
          <For each={PROFILES}>{(p) => <option value={p.value}>{p.label}</option>}</For>
        </select>
        <button onClick={() => (editing() ? stopDrawing() : startDrawing(route.id))}>
          {editing() ? 'Done' : 'Edit'}
        </button>
      </div>
    </li>
  )
}
