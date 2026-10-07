/** What a match did, for the note below the layer and in the dialog. */
export interface MatchNote {
  /** A warning when something needs a closer look. */
  kind: 'info' | 'warning'
  text: string
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Which towns placed the image and which were left out. Towns left out, and a placement
 * by only two towns (which nothing checks), make it a warning.
 */
export function describeMatch(placed: readonly string[], left: readonly string[]): MatchNote {
  const sentences = [`Placed by ${listNames(placed)}.`]
  if (left.length === 1) sentences.push(`${left[0]} does not fit the others and was left out.`)
  if (left.length > 1) sentences.push(`${listNames(left)} do not fit the others and were left out.`)
  if (placed.length < 3) sentences.push('Two towns cannot be checked against each other, so look closely.')
  sentences.push('Pin three or more point pairs and skew for a closer fit.')
  return { kind: left.length > 0 || placed.length < 3 ? 'warning' : 'info', text: sentences.join(' ') }
}
