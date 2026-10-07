import { describe, expect, it } from 'vitest'
import { BASE_MAPS } from '../config.ts'
import { groupRuns } from './groups.ts'

type Option = { v: number; group?: string }

describe('groupRuns', () => {
  it('keeps the order and puts neighbours of one group together', () => {
    const runs = groupRuns<Option>([{ v: 1, group: 'A' }, { v: 2, group: 'A' }, { v: 3, group: 'B' }, { v: 4 }])
    expect(runs.map((r) => [r.group, r.options.map((o) => o.v)])).toEqual([
      ['A', [1, 2]],
      ['B', [3]],
      [undefined, [4]],
    ])
  })

  it('leaves options without groups as one run', () => {
    expect(groupRuns<Option>([{ v: 1 }, { v: 2 }])).toEqual([{ group: undefined, options: [{ v: 1 }, { v: 2 }] }])
  })
})

describe('base map menu', () => {
  it('starts with the world and lists each region once', () => {
    const regions = groupRuns(Object.values(BASE_MAPS).map((b) => ({ group: b.region }))).map((r) => r.group)
    expect(regions[0]).toBe('World')
    expect(new Set(regions).size).toBe(regions.length)
  })
})
