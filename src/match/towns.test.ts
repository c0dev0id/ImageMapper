import { describe, expect, it } from 'vitest'
import { fromMercator } from '../geo/mercator.ts'
import type { LngLat, Px } from '../geo/types.ts'
import { toImage, toMap, type Fit } from './fit.ts'
import type { Gcp } from '../state/schema.ts'
import { completeTowns, fitTowns, replaceTownPairs, rowNote, type TownPair, type TownRow } from './towns.ts'

const W = 1500
const H = 900
// The printed map: 3° clockwise, about 50 m per pixel in the Westerwald.
const angle = (3 * Math.PI) / 180
const scale = 1.25e-6
const truth: Fit = { c: scale * Math.cos(angle), s: scale * Math.sin(angle), tx: 0.5216, ty: 0.3384 }
const at = (image: Px): LngLat => fromMercator(toMap(truth, image))
const town = (name: string, image: Px, map: LngLat): TownPair => ({ name, image, map })

/** Image pixels between where a fit and the truth put an image point. */
const offset = (fit: Fit, image: Px) => {
  const [x, y] = toImage(fit, toMap(truth, image))
  return Math.hypot(x - image[0], y - image[1])
}

describe('fitTowns', () => {
  it('places the image by the towns, averaging out taps a little off', () => {
    const { fit, misfits } = fitTowns(
      [
        town('Hachenburg', [880, 270], at([883, 268])),
        town('Westerburg', [1170, 550], at([1166, 553])),
        town('Montabaur', [910, 820], at([912, 817])),
        town('Neustadt', [100, 310], at([97, 312])),
      ],
      W,
      H,
    )
    expect(misfits).toEqual([])
    for (const corner of [[0, 0], [W, 0], [W, H], [0, H]] as Px[]) expect(offset(fit!, corner)).toBeLessThan(6)
  })

  it('leaves out a town picked at the wrong place', () => {
    const { fit, misfits } = fitTowns(
      [
        town('Hachenburg', [880, 270], at([880, 270])),
        town('Westerburg', [1170, 550], at([1170, 550])),
        // A namesake in the Palatinate instead of the one on the image.
        town('Neustadt', [100, 310], [8.14, 49.35]),
        town('Montabaur', [910, 820], at([910, 820])),
      ],
      W,
      H,
    )
    expect(misfits).toEqual([2])
    expect(offset(fit!, [750, 450])).toBeLessThan(1e-6)
  })

  it('takes two towns as they are', () => {
    const { fit, misfits } = fitTowns(
      [town('Hachenburg', [880, 270], at([880, 270])), town('Montabaur', [910, 820], at([910, 820]))],
      W,
      H,
    )
    expect(misfits).toEqual([])
    expect(offset(fit!, [0, 0])).toBeLessThan(1e-6)
  })

  it('needs two spots apart from each other', () => {
    expect(fitTowns([town('A', [500, 400], at([500, 400]))], W, H).fit).toBeUndefined()
    expect(fitTowns([town('A', [500, 400], at([500, 400])), town('B', [510, 405], at([510, 405]))], W, H).fit).toBeUndefined()
  })

  it('rejects placements that would make the image absurdly small or large', () => {
    // Two places 1 km apart across the whole image make a 1.5 km wide map, which is fine;
    // 10,000 km apart they do not.
    expect(fitTowns([town('A', [0, 450], [8, 50]), town('B', [1500, 450], [8.014, 50])], W, H).fit).toBeDefined()
    expect(fitTowns([town('A', [0, 450], [-100, 40]), town('B', [1500, 450], [100, 40])], W, H).fit).toBeUndefined()
  })
})

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

describe('town rows', () => {
  const kleve = { name: 'Kleve', label: 'Kleve, Nordrhein-Westfalen, Deutschland', center: [6.14, 51.79] as LngLat }
  const goch = { name: 'Goch', label: 'Goch, Nordrhein-Westfalen, Deutschland', center: [6.16, 51.68] as LngLat }
  const rows: TownRow[] = [
    { term: 'Kleve', place: kleve, image: [120, 80] },
    { term: '' },
    { term: 'Goch', place: goch },
    { term: 'Goch', place: goch, image: [130, 300], misfit: true },
  ]

  it('takes the towns of rows with a place and a spot, with their row positions', () => {
    expect(completeTowns(rows)).toEqual({
      towns: [
        { name: 'Kleve', image: [120, 80], map: [6.14, 51.79] },
        { name: 'Goch', image: [130, 300], map: [6.16, 51.68] },
      ],
      rows: [0, 3],
    })
  })

  it('says what a started row still needs', () => {
    expect(rows.map(rowNote)).toEqual([undefined, undefined, 'image', 'fit'])
    expect(rowNote({ term: 'Xanten' })).toBe('place')
    expect(rowNote({ term: '', image: [5, 5] })).toBe('place')
  })
})
