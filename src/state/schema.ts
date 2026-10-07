import type { LngLat, Pair, Px } from '../geo/types.ts'

export const PROJECT_VERSION = 2

export type Side = 'image' | 'map'

/** How an image layer is mixed with what lies below it (the W3C compositing modes). */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'darken'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'difference'
export type Profile = 'car' | 'bike' | 'foot'

/** A ground control point; either side may still be missing. */
export interface Gcp {
  id: string
  image?: Px
  map?: LngLat
}

export interface ImageLayer {
  id: string
  name: string
  mime: string
  /** Size of the image after applying its EXIF orientation; GCP pixels refer to this. */
  width: number
  height: number
  visible: boolean
  opacity: number
  /** Absent means normal. */
  blend?: BlendMode
  /** The pairs the displayed warp is fitted on (at least 3). */
  placement: Pair[]
  gcps: Gcp[]
}

/** A point a route runs through. */
export interface RoutePoint {
  id: string
  lngLat: LngLat
}

export interface Route {
  id: string
  name: string
  profile: Profile
  color: string
  /** The points the route runs through, in order. */
  points: RoutePoint[]
  /** Routed geometry per leg as polyline6, keyed by profile and both end points. */
  legs: Record<string, string>
}

/** A named place of its own (a GPX waypoint), independent of the routes. */
export interface Waypoint {
  id: string
  lngLat: LngLat
  name: string
  description?: string
}

export interface View {
  center: LngLat
  zoom: number
  bearing: number
  pitch: number
}

export interface Project {
  version: typeof PROJECT_VERSION
  name: string
  view: View
  satellite: { visible: boolean; opacity: number }
  /** Bottom layer first. */
  layers: ImageLayer[]
  activeLayerId?: string
  routes: Route[]
  waypoints: Waypoint[]
}

export function emptyProject(): Project {
  return {
    version: PROJECT_VERSION,
    name: 'Untitled',
    view: { center: [0, 30], zoom: 2, bearing: 0, pitch: 0 },
    satellite: { visible: false, opacity: 1 },
    layers: [],
    routes: [],
    waypoints: [],
  }
}

/** Whether the project holds work that New or Open would throw away (and cannot undo). */
export function hasContent(project: Project): boolean {
  return project.layers.length > 0 || project.routes.length > 0 || project.waypoints.length > 0
}

/** Parses a stored or loaded project; rejects other versions (no migrations before 1.0). */
export function parseProject(json: string): Project {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('The project data is not valid JSON.')
  }
  if (!isRecord(data) || !Array.isArray(data.layers) || !Array.isArray(data.routes)) {
    throw new Error('This is not a mappic project.')
  }
  if (data.version !== PROJECT_VERSION) {
    throw new Error(
      `Project version ${String(data.version)} is not supported; this mappic reads version ${PROJECT_VERSION}.`,
    )
  }
  return { ...emptyProject(), ...data } as Project
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
