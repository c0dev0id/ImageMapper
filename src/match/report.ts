import { roundImagePoint, roundMapPoint } from '../gcp/gcps.ts'
import type { Gcp } from '../state/schema.ts'
import type { TownMatch, TownMiss, TownSolution } from './solve.ts'

/** What a match did, for the note below the layer and in the dialog. */
export interface MatchNote {
  /** A warning when something needs a closer look. */
  kind: 'info' | 'warning'
  text: string
}

/**
 * A layer's point pairs after a match: the pairs the previous match created, edited or
 * not, give way to one pair per matched town, marked with its name and at the precision
 * of other point pairs. Pairs pinned by hand stay.
 */
export function replaceTownPairs(gcps: readonly Gcp[], matches: readonly TownMatch[], makeId: () => string): Gcp[] {
  return [
    ...gcps.filter((g) => g.town === undefined),
    ...matches.map((m) => ({ id: makeId(), image: roundImagePoint(m.image), map: roundMapPoint(m.map), town: m.name })),
  ]
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** One sentence per reason, e.g. "Selters and Hof were not read on the image." */
export function describeMisses(misses: readonly TownMiss[]): string[] {
  const sentences: string[] = []
  const phrases: Record<TownMiss['reason'], [one: string, many: string]> = {
    image: ['was not read on the image', 'were not read on the image'],
    map: ['was not found on the map', 'were not found on the map'],
    fit: ['does not fit the others', 'do not fit the others'],
  }
  for (const reason of ['image', 'map', 'fit'] as const) {
    const names = misses.filter((m) => m.reason === reason).map((m) => m.name)
    if (names.length) sentences.push(`${listNames(names)} ${phrases[reason][names.length === 1 ? 0 : 1]}.`)
  }
  return sentences
}

/**
 * What a match did, or why it could not place the image. Missed towns, and a fit on only
 * two towns (which nothing checks), make it a warning.
 */
export function describeSolution(solution: TownSolution): MatchNote {
  const misses = describeMisses(solution.misses)
  if (!solution.fit) {
    return {
      kind: 'warning',
      text: [
        'The image could not be placed.',
        ...misses,
        'At least two towns must be read on the image and found on the map.',
      ].join(' '),
    }
  }
  const unchecked = solution.matches.length < 3
  return {
    kind: misses.length > 0 || unchecked ? 'warning' : 'info',
    text: [
      `Placed by ${listNames(solution.matches.map((m) => m.name))}.`,
      ...misses,
      unchecked ? 'Two towns cannot be checked against each other, so look closely.' : '',
      'The rings sit on the printed names: drag each onto its town, then skew.',
    ]
      .filter(Boolean)
      .join(' '),
  }
}
