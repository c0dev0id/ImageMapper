import { describe, expect, it } from 'vitest'
import type { Gcp } from '../state/schema.ts'
import { describeMisses, describeSolution, listNames, townPairs } from './report.ts'
import type { TownMatch } from './solve.ts'

const match = (name: string, image: [number, number], map: [number, number]): TownMatch => ({
  name,
  image,
  map,
  residual: 3,
})
const fit = { c: 1e-6, s: 0, tx: 0.5, ty: 0.3 }

describe('townPairs', () => {
  it('rounds like the other point pairs and skips names pinned before', () => {
    let next = 0
    const existing: Gcp[] = [{ id: 'old', image: [888.12, 271.5], map: [7.82, 50.66] }]
    const pairs = townPairs(
      [match('Hachenburg', [888.123456, 271.5], [7.82, 50.66]), match('Westerburg', [1172.3333, 546.6666], [7.9712345678, 50.5598765432])],
      existing,
      () => `new-${next++}`,
    )
    expect(pairs).toEqual([{ id: 'new-0', image: [1172.33, 546.67], map: [7.9712346, 50.5598765] }])
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
      describeMisses([
        { name: 'Selters', reason: 'image' },
        { name: 'Hof', reason: 'image' },
        { name: 'Atlantis', reason: 'map' },
        { name: 'Marienberg', reason: 'fit' },
      ]),
    ).toEqual([
      'Selters and Hof were not read on the image.',
      'Atlantis was not found on the map.',
      'Marienberg does not fit the others.',
    ])
  })
})

describe('describeSolution', () => {
  it('names the towns used and what to do next', () => {
    const text = describeSolution({
      fit,
      matches: [match('Kleve', [1, 1], [6, 51]), match('Goch', [9, 9], [6.1, 51.6]), match('Wesel', [5, 1], [6.6, 51.6])],
      misses: [{ name: 'Xanten', reason: 'image' }],
    })
    expect(text).toBe(
      'Placed by Kleve, Goch and Wesel. Xanten was not read on the image. ' +
        'The rings sit on the printed names: drag each onto its town, then skew.',
    )
  })

  it('warns when only two towns placed the image', () => {
    const text = describeSolution({ fit, matches: [match('Kleve', [1, 1], [6, 51]), match('Goch', [9, 9], [6.1, 51.6])], misses: [] })
    expect(text).toContain('Two towns cannot be checked against each other')
  })

  it('explains a failure', () => {
    expect(describeSolution({ matches: [], misses: [{ name: 'Kleve', reason: 'fit' }, { name: 'Goch', reason: 'image' }] })).toBe(
      'The image could not be placed. Goch was not read on the image. Kleve does not fit the others. ' +
        'At least two towns must be read on the image and found on the map.',
    )
  })
})
