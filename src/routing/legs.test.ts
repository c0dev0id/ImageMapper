import { describe, expect, it } from 'vitest'
import type { Route } from '../state/schema.ts'
import type { LngLat } from '../geo/types.ts'
import { legKey, nextMissingLeg, pruneLegs, roundLngLat, routeLegs, routePoints } from './legs.ts'

const route = (id: string, points: [number, number][], legs: Record<string, string> = {}): Route => ({
  id,
  name: id,
  profile: 'bike',
  color: '#000',
  waypoints: points.map((lngLat, i) => ({ id: `${id}${i}`, lngLat })),
  legs,
})

describe('legs', () => {
  it('builds keys from profile and coordinates', () => {
    expect(legKey('car', [11.5, 48.1], [11.6, 48.2])).toBe('car/11.5,48.1;11.6,48.2')
  })

  it('needs one leg per pair of consecutive waypoints', () => {
    expect(routeLegs(route('r', [[1, 1]]))).toEqual([])
    expect(routeLegs(route('r', [[1, 1], [2, 2], [3, 3]])).map((l) => l.key)).toEqual([
      'bike/1,1;2,2',
      'bike/2,2;3,3',
    ])
  })

  it('drops cached legs that are no longer needed', () => {
    const r = route('r', [[1, 1], [2, 2]], { 'bike/1,1;2,2': 'a', 'bike/2,2;3,3': 'b', 'car/1,1;2,2': 'c' })
    expect(pruneLegs(r)).toEqual({ 'bike/1,1;2,2': 'a' })
  })

  it('finds the next missing leg, skipping cached and failed ones', () => {
    const r = route('r', [[1, 1], [2, 2], [3, 3], [4, 4]], { 'bike/1,1;2,2': 'a' })
    const failed = new Set(['bike/2,2;3,3'])
    expect(nextMissingLeg([r], failed)).toMatchObject({ routeId: 'r', key: 'bike/3,3;4,4', from: [3, 3], to: [4, 4] })
    expect(nextMissingLeg([route('done', [[1, 1], [2, 2]], { 'bike/1,1;2,2': 'a' })], new Set())).toBeUndefined()
  })

  it('serves the preferred route first', () => {
    const a = route('a', [[1, 1], [2, 2]])
    const b = route('b', [[5, 5], [6, 6]])
    expect(nextMissingLeg([a, b], new Set(), 'b')?.routeId).toBe('b')
    expect(nextMissingLeg([a, b], new Set())?.routeId).toBe('a')
  })

  it('rounds coordinates to six decimals', () => {
    expect(roundLngLat([11.12345678, -48.98765432])).toEqual([11.123457, -48.987654])
  })
})

const decode = (geometry: string): LngLat[] => JSON.parse(geometry)
const tour: Route = {
  ...route('t', [
    [1, 1],
    [2, 2],
    [3, 3],
  ]),
  profile: 'car',
  legs: { 'car/1,1;2,2': '[[1,1],[1.5,1.2],[2,2]]', 'car/2,2;3,3': '[[2,2],[2.5,2.8],[3,3]]' },
}

describe('routePoints', () => {
  it('joins routed legs without repeating the shared point', () => {
    expect(routePoints(tour, decode)).toEqual([[1, 1], [1.5, 1.2], [2, 2], [2.5, 2.8], [3, 3]])
  })

  it('uses straight lines for legs that are not routed', () => {
    const partial = { ...tour, legs: { 'car/1,1;2,2': '[[1,1],[1.5,1.2],[2,2]]' } }
    expect(routePoints(partial, decode)).toEqual([[1, 1], [1.5, 1.2], [2, 2], [3, 3]])
  })
})

