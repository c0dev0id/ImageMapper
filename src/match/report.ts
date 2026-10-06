import { roundImagePoint, roundMapPoint } from '../gcp/gcps.ts'
import type { Gcp } from '../state/schema.ts'
import type { TownPair } from './solve.ts'

/** What a match did, for the note below the layer and in the dialog. */
export interface MatchNote {
  /** A warning when something needs a closer look. */
  kind: 'info' | 'warning'
  text: string
}

/**
 * A layer's point pairs after a match: the pairs the previous match created, edited or
 * not, give way to the towns', marked with their names and at the precision of other
 * point pairs. Pairs pinned by hand stay.
 */
export function replaceTownPairs(gcps: readonly Gcp[], towns: readonly TownPair[], makeId: () => string): Gcp[] {
  return [
    ...gcps.filter((g) => g.town === undefined),
    ...towns.map((t) => ({ id: makeId(), image: roundImagePoint(t.image), map: roundMapPoint(t.map), town: t.name })),
  ]
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Which towns placed the image and which were left out. Towns left out, and a placement
 * by only two towns (which nothing checks), make it a warning.
 */
export function describeMatch(towns: readonly TownPair[], misfits: readonly number[]): MatchNote {
  const placed = towns.filter((_, i) => !misfits.includes(i)).map((t) => t.name)
  const left = misfits.map((i) => towns[i].name)
  const sentences = [`Placed by ${listNames(placed)}.`]
  if (left.length === 1) sentences.push(`${left[0]} does not fit the others and was left out.`)
  if (left.length > 1) sentences.push(`${listNames(left)} do not fit the others and were left out.`)
  sentences.push(
    placed.length < 3
      ? 'Two towns cannot be checked against each other, so look closely; skewing needs a third pair.'
      : 'Skew to fit the image to the pairs exactly.',
  )
  return { kind: left.length > 0 || placed.length < 3 ? 'warning' : 'info', text: sentences.join(' ') }
}
