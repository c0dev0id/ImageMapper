import type { LngLat } from '../geo/types.ts'
import type { Profile, Route } from '../state/schema.ts'

/** Cache key of a routed leg: profile and both end points (exact coordinates). */
export function legKey(profile: Profile, from: LngLat, to: LngLat): string {
  return `${profile}/${from[0]},${from[1]};${to[0]},${to[1]}`
}

export interface Leg {
  key: string
  from: LngLat
  to: LngLat
  /** Drawn and exported as the straight line between its ends, never routed. */
  straight: boolean
}

type RoutePath = Pick<Route, 'profile' | 'points'>

/** The legs of a route: one per pair of consecutive points, straight where the second point says so. */
export function routeLegs(route: RoutePath): Leg[] {
  const legs: Leg[] = []
  for (let i = 1; i < route.points.length; i++) {
    const from = route.points[i - 1].lngLat
    const to = route.points[i].lngLat
    legs.push({ key: legKey(route.profile, from, to), from, to, straight: route.points[i].straight === true })
  }
  return legs
}

/** The legs that are routed, not straight. */
export function routedLegs(route: RoutePath): Leg[] {
  return routeLegs(route).filter((leg) => !leg.straight)
}

/** The routed geometry of a leg, if it has arrived; a straight leg never has one. */
export function legGeometry(route: Pick<Route, 'legs'>, leg: Leg): string | undefined {
  return leg.straight ? undefined : route.legs[leg.key]
}

/**
 * The points of a route: routed legs in order, straight and unrouted legs as the straight
 * line shown on the map, with the shared point between consecutive legs only once.
 */
export function routePoints(
  route: RoutePath & Pick<Route, 'legs'>,
  decode: (geometry: string) => LngLat[],
): LngLat[] {
  const points: LngLat[] = []
  for (const leg of routeLegs(route)) {
    const geometry = legGeometry(route, leg)
    for (const p of geometry ? decode(geometry) : [leg.from, leg.to]) {
      const last = points.at(-1)
      if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push([p[0], p[1]])
    }
  }
  return points
}

/** The cached legs the route still needs; everything else, straight legs included, is dropped. */
export function pruneLegs(route: RoutePath & Pick<Route, 'legs'>): Record<string, string> {
  const needed = new Set(routedLegs(route).map((l) => l.key))
  return Object.fromEntries(Object.entries(route.legs).filter(([key]) => needed.has(key)))
}

export interface LegJob extends Leg {
  routeId: string
  profile: Profile
}

/** The next routed leg without geometry that has not failed; the edited route goes first. */
export function nextMissingLeg(
  routes: readonly Route[],
  failed: ReadonlySet<string>,
  preferRouteId?: string,
): LegJob | undefined {
  const ordered = [...routes].sort((a, b) => Number(b.id === preferRouteId) - Number(a.id === preferRouteId))
  for (const route of ordered) {
    for (const leg of routedLegs(route)) {
      if (!(leg.key in route.legs) && !failed.has(leg.key)) {
        return { ...leg, routeId: route.id, profile: route.profile }
      }
    }
  }
  return undefined
}

/** Rounds a coordinate to 6 decimals (about 0.1 m) so keys, URLs and exports agree. */
export function roundLngLat([lng, lat]: LngLat): LngLat {
  return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6]
}
