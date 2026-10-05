import { ROUTING_TIMEOUT_MS, ROUTING_URL } from '../config.ts'
import type { LngLat } from '../geo/types.ts'
import type { Profile } from '../state/schema.ts'

/** OSRM route request for one leg on the FOSSGIS servers (profile selected by path). */
export function routeUrl(base: string, profile: Profile, from: LngLat, to: LngLat): string {
  return `${base}/routed-${profile}/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=polyline6`
}

/** Extracts the polyline6 geometry of the first route, or throws with the server's message. */
export function parseRouteResponse(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'code' in data) {
    const response = data as { code: unknown; message?: unknown; routes?: { geometry?: unknown }[] }
    const geometry = response.routes?.[0]?.geometry
    if (response.code === 'Ok' && typeof geometry === 'string') return geometry
    throw new Error(typeof response.message === 'string' ? response.message : `Routing failed (${String(response.code)}).`)
  }
  throw new Error('Unexpected answer from the routing server.')
}

/** Routes one leg; rejects on network errors, timeouts and routing errors. */
export async function fetchLeg(
  leg: { profile: Profile; from: LngLat; to: LngLat },
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchFn(routeUrl(ROUTING_URL, leg.profile, leg.from, leg.to), {
    signal: AbortSignal.timeout(ROUTING_TIMEOUT_MS),
  })
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(`The routing server answered with status ${response.status}.`)
  }
  return parseRouteResponse(data)
}

export interface PumpDeps<Job> {
  /** The next job from the current state, or undefined when nothing is missing. */
  next(): Job | undefined
  run(job: Job): Promise<string>
  onResult(job: Job, result: string): void
  onFailure(job: Job, error: unknown): void
  wait(ms: number): Promise<void>
  /** Pause after every request; FOSSGIS allows at most one request per second. */
  interval: number
}

/**
 * A pull-based request loop: each iteration asks the current state for the next missing
 * job, so nothing stale is ever queued. Calling the pump while it runs does nothing; the
 * running loop picks up new work after its pause.
 */
export function createPump<Job>(deps: PumpDeps<Job>): () => Promise<void> {
  let running = false
  return async () => {
    if (running) return
    running = true
    try {
      for (let job = deps.next(); job !== undefined; job = deps.next()) {
        try {
          deps.onResult(job, await deps.run(job))
        } catch (error) {
          deps.onFailure(job, error)
        }
        await deps.wait(deps.interval)
      }
    } finally {
      running = false
    }
  }
}
