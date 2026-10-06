import { describe, expect, it } from 'vitest'
import type { Gcp } from '../state/schema.ts'
import { describeMatch, listNames, replaceTownPairs } from './report.ts'
import type { TownPair } from './solve.ts'

const town = (name: string, image: [number, number], map: [number, number]): TownPair => ({ name, image, map })

describe('replaceTownPairs', () => {
  it('replaces the pairs of the previous match, keeps pairs pinned by hand and marks the new ones', () => {
    let next = 0
    const gcps: Gcp[] = [
      { id: 'hand', image: [10, 10], map: [7, 50] },
      { id: 'old', image: [880, 260], map: [7.82, 50.66], town: 'Hachenburg' },
      // A pair of the previous match with its image side removed by the user.
      { id: 'half', map: [7.97, 50.56], town: 'Westerburg' },
    ]
    const towns = [
      town('Hachenburg', [888.123456, 271.5], [7.82, 50.66]),
      town('Westerburg', [1172.3333, 546.6666], [7.9712345678, 50.5598765432]),
    ]
    expect(replaceTownPairs(gcps, towns, () => `new-${next++}`)).toEqual([
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

describe('describeMatch', () => {
  const towns = [town('Kleve', [1, 1], [6, 51]), town('Goch', [9, 9], [6.1, 51.6]), town('Wesel', [5, 1], [6.6, 51.6])]

  it('names the towns used and what to do next', () => {
    expect(describeMatch(towns, [])).toEqual({
      kind: 'info',
      text: 'Placed by Kleve, Goch and Wesel. Skew to fit the image to the pairs exactly.',
    })
  })

  it('warns about towns left out', () => {
    expect(describeMatch([...towns, town('Xanten', [3, 3], [6.4, 51.7])], [3])).toEqual({
      kind: 'warning',
      text:
        'Placed by Kleve, Goch and Wesel. Xanten does not fit the others and was left out. ' +
        'Skew to fit the image to the pairs exactly.',
    })
    expect(describeMatch(towns, [0, 2]).text).toContain('Kleve and Wesel do not fit the others and were left out.')
  })

  it('warns when only two towns placed the image', () => {
    const note = describeMatch(towns.slice(0, 2), [])
    expect(note.kind).toBe('warning')
    expect(note.text).toContain('Two towns cannot be checked against each other')
  })
})
