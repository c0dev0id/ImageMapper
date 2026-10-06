import { describe, expect, it } from 'vitest'
import type { Gcp } from '../state/schema.ts'
import { describeMisses, describeSolution, listNames, replaceTownPairs } from './report.ts'
import type { TownMatch, TownMiss } from './solve.ts'

const match = (name: string, image: [number, number], map: [number, number]): TownMatch => ({ index: 0, name, image, map })
const miss = (name: string, reason: TownMiss['reason']): TownMiss => ({ index: 0, name, reason })
const fit = { c: 1e-6, s: 0, tx: 0.5, ty: 0.3 }

describe('replaceTownPairs', () => {
  it('replaces the pairs of the previous match, keeps pairs pinned by hand and marks the new ones', () => {
    let next = 0
    const gcps: Gcp[] = [
      { id: 'hand', image: [10, 10], map: [7, 50] },
      { id: 'old', image: [880, 260], map: [7.82, 50.66], town: 'Hachenburg' },
      // A pair of the previous match with its image side removed by the user.
      { id: 'half', map: [7.97, 50.56], town: 'Westerburg' },
    ]
    const matches = [
      match('Hachenburg', [888.123456, 271.5], [7.82, 50.66]),
      match('Westerburg', [1172.3333, 546.6666], [7.9712345678, 50.5598765432]),
    ]
    expect(replaceTownPairs(gcps, matches, () => `new-${next++}`)).toEqual([
      { id: 'hand', image: [10, 10], map: [7, 50] },
      { id: 'new-0', image: [888.12, 271.5], map: [7.82, 50.66], town: 'Hachenburg' },
      { id: 'new-1', image: [1172.33, 546.67], map: [7.9712346, 50.5598765], town: 'Westerburg' },
    ])
  })
})

describe('listNames', () => {
  it('joins with commas and a final "and"', () => {
    expect(listNames([])).toBe('')
    expect(listNames(['Kleve'])).toBe('Kleve')
    expect(listNames(['Kleve', 'Goch'])).toBe('Kleve and Goch')
    expect(listNames(['Kleve', 'Goch', 'Wesel'])).toBe('Kleve, Goch and Wesel')
  })
})

describe('describeMisses', () => {
  it('says one sentence per reason, in singular or plural', () => {
    expect(
      describeMisses([miss('Selters', 'image'), miss('Hof', 'image'), miss('Atlantis', 'map'), miss('Marienberg', 'fit')]),
    ).toEqual([
      'Selters and Hof were not read on the image.',
      'Atlantis was not found on the map.',
      'Marienberg does not fit the others.',
    ])
  })
})

describe('describeSolution', () => {
  const three = [match('Kleve', [1, 1], [6, 51]), match('Goch', [9, 9], [6.1, 51.6]), match('Wesel', [5, 1], [6.6, 51.6])]

  it('names the towns used and what to do next', () => {
    expect(describeSolution({ fit, matches: three, misses: [] })).toEqual({
      kind: 'info',
      text: 'Placed by Kleve, Goch and Wesel. The rings sit on the printed names: drag each onto its town, then skew.',
    })
  })

  it('warns about missed towns', () => {
    expect(describeSolution({ fit, matches: three, misses: [miss('Xanten', 'image')] })).toEqual({
      kind: 'warning',
      text:
        'Placed by Kleve, Goch and Wesel. Xanten was not read on the image. ' +
        'The rings sit on the printed names: drag each onto its town, then skew.',
    })
  })

  it('warns when only two towns placed the image', () => {
    const note = describeSolution({ fit, matches: three.slice(0, 2), misses: [] })
    expect(note.kind).toBe('warning')
    expect(note.text).toContain('Two towns cannot be checked against each other')
  })

  it('explains a failure', () => {
    expect(describeSolution({ matches: [], misses: [miss('Kleve', 'fit'), miss('Goch', 'image')] })).toEqual({
      kind: 'warning',
      text:
        'The image could not be placed. Goch was not read on the image. Kleve does not fit the others. ' +
        'At least two towns must be read on the image and found on the map.',
    })
  })
})
