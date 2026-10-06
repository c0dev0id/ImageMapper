import { describe, expect, it } from 'vitest'
import type { Route } from '../state/schema.ts'
import { addLeg, appendPoint, changeProfile, insertPoint, movePoint, nextRouteColor, removePoint } from './routeEdit.ts'

const base: Route = {
  id: 'r',
  name: 'Route 1',
  profile: 'car',
  color: '#e8590c',
  points: [
    { id: 'a', lngLat: [1, 1] },
    { id: 'b', lngLat: [2, 2] },
    { id: 'c', lngLat: [3, 3] },
  ],
  legs: { 'car/1,1;2,2': 'ab', 'car/2,2;3,3': 'bc' },
}

describe('route edits', () => {
  it('appends a point and keeps all legs', () => {
    const r = appendPoint(base, { id: 'd', lngLat: [4, 4] })
    expect(r.points.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(r.legs).toEqual(base.legs)
  })

  it('inserts a point and keeps only the legs it does not split', () => {
    const r = insertPoint(base, 1, { id: 'x', lngLat: [1.5, 1.5] })
    expect(r.points.map((p) => p.id)).toEqual(['a', 'x', 'b', 'c'])
    expect(r.legs).toEqual({ 'car/2,2;3,3': 'bc' })
  })

  it('drops both legs next to a moved point', () => {
    const r = movePoint(base, 'b', [2.5, 2.5])
    expect(r.points[1].lngLat).toEqual([2.5, 2.5])
    expect(r.legs).toEqual({})
  })

  it('drops the legs of a removed middle point', () => {
    const r = removePoint(base, 'b')
    expect(r.points.map((p) => p.id)).toEqual(['a', 'c'])
    expect(r.legs).toEqual({})
  })

  it('keeps the remaining leg when the last point is removed', () => {
    expect(removePoint(base, 'c').legs).toEqual({ 'car/1,1;2,2': 'ab' })
  })

  it('drops every leg when the profile changes', () => {
    const r = changeProfile(base, 'bike')
    expect(r.profile).toBe('bike')
    expect(r.legs).toEqual({})
  })

  it('stores needed legs and ignores outdated results', () => {
    const r = movePoint(base, 'c', [9, 9])
    expect(addLeg(r, 'car/2,2;9,9', 'new').legs).toEqual({ 'car/1,1;2,2': 'ab', 'car/2,2;9,9': 'new' })
    expect(addLeg(r, 'car/2,2;3,3', 'stale')).toBe(r)
  })

  it('does not modify its input', () => {
    movePoint(base, 'b', [5, 5])
    expect(base.points[1].lngLat).toEqual([2, 2])
    expect(Object.keys(base.legs)).toHaveLength(2)
  })
})

describe('nextRouteColor', () => {
  it('picks the first unused colour', () => {
    expect(nextRouteColor([])).toBe('#e8590c')
    expect(nextRouteColor([{ color: '#e8590c' }])).toBe('#1971c2')
  })
})
