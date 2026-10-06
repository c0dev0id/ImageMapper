import { describe, expect, it } from 'vitest'
import { fromMercator } from '../geo/mercator.ts'
import type { LngLat, Px } from '../geo/types.ts'
import { fitAngle, toMap, type Fit } from './fit.ts'
import { solveTowns, type TownCandidates } from './solve.ts'

const W = 1500
const H = 900
// The printed map: 3° clockwise, about 50 m per pixel in the Westerwald.
const angle = (3 * Math.PI) / 180
const scale = 1.25e-6
const truth: Fit = { c: scale * Math.cos(angle), s: scale * Math.sin(angle), tx: 0.5216, ty: 0.3384 }
const at = (image: Px): LngLat => fromMercator(toMap(truth, image))
/** Somewhere else entirely, like a namesake in another region. */
const elsewhere = (lng: number, lat: number): LngLat => [lng, lat]

const hachenburg: Px = [880, 270]
const westerburg: Px = [1170, 550]
const montabaur: Px = [910, 820]
const neustadt: Px = [100, 310]

const town = (name: string, image: Px[], map: LngLat[]): TownCandidates => ({ name, image, map })

describe('solveTowns', () => {
  it('picks the candidates that agree on one transform', () => {
    const solution = solveTowns(
      [
        // The printed label is a little off the town, as labels are.
        town('Hachenburg', [hachenburg], [at([870, 255])]),
        town('Westerburg', [westerburg], [elsewhere(9.7, 52.1), at([1160, 560])]),
        town('Montabaur', [[400, 100], montabaur], [at([905, 830])]),
        town('Neustadt', [neustadt], [elsewhere(8.1, 49.35), elsewhere(11.2, 50.3), at([95, 300])]),
      ],
      W,
      H,
    )
    expect(solution.misses).toEqual([])
    expect(solution.matches.map((m) => [m.name, m.image])).toEqual([
      ['Hachenburg', hachenburg],
      ['Westerburg', westerburg],
      ['Montabaur', montabaur],
      ['Neustadt', neustadt],
    ])
    expect(solution.matches.map((m) => m.map)).toEqual([at([870, 255]), at([1160, 560]), at([905, 830]), at([95, 300])])
    expect(fitAngle(solution.fit!)).toBeCloseTo(angle, 1)
  })

  it('leaves out a town that does not fit and says why the others are missing', () => {
    const solution = solveTowns(
      [
        town('Hachenburg', [hachenburg], [at(hachenburg)]),
        town('Westerburg', [westerburg], [at(westerburg)]),
        town('Montabaur', [montabaur], [at(montabaur)]),
        // A misread: the label of another town, far from where Marienberg is.
        town('Marienberg', [[1480, 690]], [at([1000, 300])]),
        town('Selters', [], [at([700, 600])]),
        town('Atlantis', [[300, 300]], []),
      ],
      W,
      H,
    )
    expect(solution.matches.map((m) => m.name)).toEqual(['Hachenburg', 'Westerburg', 'Montabaur'])
    expect(solution.misses).toEqual([
      { index: 3, name: 'Marienberg', reason: 'fit' },
      { index: 4, name: 'Selters', reason: 'image' },
      { index: 5, name: 'Atlantis', reason: 'map' },
    ])
  })

  it('with two towns, prefers an upright map over a turned one', () => {
    // The second candidate for Westerburg would turn the image by about 30°.
    const turned = fromMercator(toMap({ ...truth, c: scale * Math.cos(0.6), s: scale * Math.sin(0.6) }, westerburg))
    const solution = solveTowns(
      [town('Hachenburg', [hachenburg], [at(hachenburg)]), town('Westerburg', [westerburg], [turned, at(westerburg)])],
      W,
      H,
    )
    expect(solution.matches).toHaveLength(2)
    expect(Math.abs(fitAngle(solution.fit!))).toBeLessThan(0.1)
  })

  it('does not use one printed name for two towns', () => {
    const solution = solveTowns(
      [
        town('Merenberg', [[1480, 690]], [at([1480, 690])]),
        town('Marienberg', [[1480, 690]], [at([1480, 690])]),
        town('Hachenburg', [hachenburg], [at(hachenburg)]),
        town('Westerburg', [westerburg], [at(westerburg)]),
      ],
      W,
      H,
    )
    expect(solution.matches.map((m) => [m.index, m.name])).toEqual([
      [0, 'Merenberg'],
      [2, 'Hachenburg'],
      [3, 'Westerburg'],
    ])
    expect(solution.misses).toEqual([{ index: 1, name: 'Marienberg', reason: 'fit' }])
  })

  it('needs two towns that agree', () => {
    const solution = solveTowns([town('Hachenburg', [hachenburg], [at(hachenburg)]), town('Selters', [], [])], W, H)
    expect(solution.fit).toBeUndefined()
    expect(solution.matches).toEqual([])
    expect(solution.misses).toEqual([
      { index: 0, name: 'Hachenburg', reason: 'fit' },
      { index: 1, name: 'Selters', reason: 'image' },
    ])
  })

  it('rejects transforms that would make the image absurdly small or large', () => {
    // Two towns 1 km apart on the map but across the whole image: a 1.5 km wide map is
    // fine; the same towns 10,000 km apart are not.
    const near = solveTowns(
      [town('A', [[0, 450]], [[8, 50]]), town('B', [[1500, 450]], [[8.014, 50]])],
      W,
      H,
    )
    expect(near.fit).toBeDefined()
    const far = solveTowns(
      [town('A', [[0, 450]], [[-100, 40]]), town('B', [[1500, 450]], [[100, 40]])],
      W,
      H,
    )
    expect(far.fit).toBeUndefined()
  })
})
