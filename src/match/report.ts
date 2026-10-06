import type { Px } from '../geo/types.ts'
import type { Gcp } from '../state/schema.ts'
import type { TownMatch, TownMiss, TownSolution } from './solve.ts'

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits

/**
 * Point pairs for the matched towns, at the GCP precision used elsewhere (2 decimals for
 * pixels, 7 for degrees). Towns already pinned at the same printed name (an earlier match)
 * are not added twice.
 */
export function townPairs(matches: readonly TownMatch[], existing: readonly Gcp[], makeId: () => string): Gcp[] {
  const pinned = (at: Px) => existing.some((g) => g.image && Math.hypot(g.image[0] - at[0], g.image[1] - at[1]) < 1)
  return matches
    .filter((m) => !pinned(m.image))
    .map((m) => ({
      id: makeId(),
      image: [round(m.image[0], 2), round(m.image[1], 2)],
      map: [round(m.map[0], 7), round(m.map[1], 7)],
    }))
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

/** What a match did, for the note below the layer; or why it could not place the image. */
export function describeSolution(solution: TownSolution): string {
  const misses = describeMisses(solution.misses)
  if (!solution.fit) {
    return [
      'The image could not be placed.',
      ...misses,
      'At least two towns must be read on the image and found on the map.',
    ].join(' ')
  }
  return [
    `Placed by ${listNames(solution.matches.map((m) => m.name))}.`,
    ...misses,
    solution.matches.length === 2 ? 'Two towns cannot be checked against each other, so look closely.' : '',
    'The rings sit on the printed names: drag each onto its town, then skew.',
  ]
    .filter(Boolean)
    .join(' ')
}
