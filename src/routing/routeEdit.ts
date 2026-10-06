import type { LngLat } from '../geo/types.ts'
import type { Profile, Route, RoutePoint } from '../state/schema.ts'
import { pruneLegs, routeLegs } from './legs.ts'

/** Pure route edits. Each result keeps exactly the cached legs it still needs. */

function withPrunedLegs(route: Route): Route {
  return { ...route, legs: pruneLegs(route) }
}

export function appendPoint(route: Route, point: RoutePoint): Route {
  return withPrunedLegs({ ...route, points: [...route.points, point] })
}

export function movePoint(route: Route, id: string, lngLat: LngLat): Route {
  return withPrunedLegs({
    ...route,
    points: route.points.map((p) => (p.id === id ? { ...p, lngLat } : p)),
  })
}

export function removePoint(route: Route, id: string): Route {
  return withPrunedLegs({ ...route, points: route.points.filter((p) => p.id !== id) })
}

export function changeProfile(route: Route, profile: Profile): Route {
  return withPrunedLegs({ ...route, profile })
}

/** Stores a routed leg if the route still needs it (the request may be outdated). */
export function addLeg(route: Route, key: string, geometry: string): Route {
  if (!routeLegs(route).some((leg) => leg.key === key)) return route
  return { ...route, legs: { ...route.legs, [key]: geometry } }
}

const PALETTE = ['#e8590c', '#1971c2', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#e03131', '#5f3dc4']

/** The first palette colour not used by another route. */
export function nextRouteColor(routes: readonly Pick<Route, 'color'>[]): string {
  const used = new Set(routes.map((r) => r.color))
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[routes.length % PALETTE.length]
}
