import { createEffect, createMemo, createRoot, createSignal } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { ROUTING_MIN_INTERVAL_MS } from '../config.ts'
import { project, setRouteLeg } from '../state/project.ts'
import { editingRouteId, errorMessage } from '../state/ui.ts'
import { nextMissingLeg, routeLegs, type LegJob } from './legs.ts'
import { createPump, fetchLeg } from './osrm.ts'

const [failedLegs, setFailedLegs] = createSignal<ReadonlySet<string>>(new Set())
const [lastError, setLastError] = createSignal<string>()

/** Keys of legs whose routing failed in this session (drawn as red dashed lines). */
export { failedLegs, lastError }

/** Clears the failures so the pump tries those legs again. */
export function retryFailedLegs(): void {
  setLastError(undefined)
  setFailedLegs(new Set<string>())
}

const pump = createPump<LegJob>({
  next: () => nextMissingLeg(unwrap(project.routes), failedLegs(), editingRouteId()),
  run: (job) => fetchLeg(job),
  onResult: (job, geometry) => setRouteLeg(job.routeId, job.key, geometry),
  onFailure: (job, error) => {
    setLastError(errorMessage(error))
    setFailedLegs((failed) => new Set(failed).add(job.key))
  },
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  interval: ROUTING_MIN_INTERVAL_MS,
})

const service = createRoot(() => {
  const pendingLegs = createMemo(() => {
    const failed = failedLegs()
    let count = 0
    for (const route of project.routes) {
      for (const leg of routeLegs(route)) if (!(leg.key in route.legs) && !failed.has(leg.key)) count++
    }
    return count
  })
  // Tracks route points, profiles, cached legs and failures; starts the pump when work appears.
  createEffect(() => {
    if (pendingLegs() > 0) void pump()
  })
  return { pendingLegs }
})

/** Number of legs still waiting for routing. */
export const pendingLegs = service.pendingLegs
