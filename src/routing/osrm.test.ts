import { describe, expect, it, vi } from 'vitest'
import { createPump, fetchLeg, parseRouteResponse, routeUrl } from './osrm.ts'

describe('routeUrl', () => {
  it('selects the profile by path and asks for the full polyline6 geometry', () => {
    expect(routeUrl('https://routing.example', 'foot', [11.5, 48.1], [11.6, 48.2])).toBe(
      'https://routing.example/routed-foot/route/v1/driving/11.5,48.1;11.6,48.2?overview=full&geometries=polyline6',
    )
  })
})

describe('parseRouteResponse', () => {
  it('returns the geometry of the first route', () => {
    expect(parseRouteResponse({ code: 'Ok', routes: [{ geometry: 'abc' }] })).toBe('abc')
  })

  it("throws the server's message for routing errors", () => {
    expect(() => parseRouteResponse({ code: 'NoRoute', message: 'Impossible route between points' })).toThrow(
      'Impossible route between points',
    )
    expect(() => parseRouteResponse({ code: 'NoSegment' })).toThrow('Routing failed (NoSegment).')
  })

  it('rejects unexpected answers', () => {
    expect(() => parseRouteResponse('nope')).toThrow(/Unexpected/)
  })
})

describe('fetchLeg', () => {
  it('requests the leg and returns its geometry', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ code: 'Ok', routes: [{ geometry: 'xyz' }] })))
    const geometry = await fetchLeg({ profile: 'car', from: [1, 2], to: [3, 4] }, fetchFn)
    expect(geometry).toBe('xyz')
    expect(fetchFn).toHaveBeenCalledWith(
      'https://routing.openstreetmap.de/routed-car/route/v1/driving/1,2;3,4?overview=full&geometries=polyline6',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('reports non-JSON answers with their status', async () => {
    const fetchFn = async () => new Response('Bad Gateway', { status: 502 })
    await expect(fetchLeg({ profile: 'car', from: [1, 2], to: [3, 4] }, fetchFn)).rejects.toThrow('status 502')
  })
})

describe('createPump', () => {
  /** A state with missing jobs, a result store and failures, like the route reconciler's. */
  function setup(missing: string[], failing: string[] = []) {
    const done = new Map<string, string>()
    const failed = new Set<string>()
    const requests: string[] = []
    const waits: number[] = []
    const pump = createPump<string>({
      next: () => missing.find((job) => !done.has(job) && !failed.has(job)),
      run: async (job) => {
        requests.push(job)
        if (failing.includes(job)) throw new Error('down')
        return `geometry of ${job}`
      },
      onResult: (job, result) => done.set(job, result),
      onFailure: (job) => failed.add(job),
      wait: async (ms) => {
        waits.push(ms)
      },
      interval: 1100,
    })
    return { pump, done, failed, requests, waits, missing }
  }

  it('fetches every missing job once and pauses after each request', async () => {
    const s = setup(['a', 'b', 'c'])
    await s.pump()
    expect(s.requests).toEqual(['a', 'b', 'c'])
    expect([...s.done.keys()]).toEqual(['a', 'b', 'c'])
    expect(s.waits).toEqual([1100, 1100, 1100])
  })

  it('marks failures instead of retrying them forever', async () => {
    const s = setup(['a', 'b'], ['a'])
    await s.pump()
    expect(s.requests).toEqual(['a', 'b'])
    expect(s.failed.has('a')).toBe(true)
    expect(s.done.has('b')).toBe(true)
  })

  it('ignores calls while running and picks up work added meanwhile', async () => {
    const s = setup(['a'])
    const first = s.pump()
    s.missing.push('b')
    await s.pump()
    await first
    expect(s.requests).toEqual(['a', 'b'])
  })

  it('can run again after finishing', async () => {
    const s = setup(['a'])
    await s.pump()
    s.missing.push('b')
    await s.pump()
    expect(s.requests).toEqual(['a', 'b'])
  })
})
