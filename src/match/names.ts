import type { Px } from '../geo/types.ts'

/** A word read from the image, with its box in image pixels. */
export interface TextWord {
  text: string
  /** [left, top, right, bottom] */
  box: [number, number, number, number]
}

/** A place on the image where a name may be printed: the centre of the word. */
export interface TextHit {
  at: Px
  /** Edit distance between the word and the name; 0 is an exact read. */
  distance: number
}

/** Lower case letters only, accents dropped and ß as ss: "Höhn (Ww.)" becomes "hohnww". */
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
}

/**
 * The word of a typed name to look for on the image: the longest one, leaving out parts
 * in brackets. "Bad Marienberg" is found by "marienberg", "Neustadt (Wied)" by "neustadt".
 */
export function keyWord(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, ' ')
    .split(/[\s\-–/.,]+/)
    .map(normalizeName)
  return words.reduce((longest, word) => (word.length > longest.length ? word : longest), '')
}

/** Levenshtein distance: insertions, deletions and substitutions. */
export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

/** Misread letters tolerated for a word of this length; short names must be read exactly. */
function tolerance(length: number): number {
  return length <= 3 ? 0 : length <= 6 ? 1 : 2
}

/**
 * Where the name is printed on the image, best reads first. Text recognition on maps
 * drops or swaps letters, so words within a few edits count; a label read together with
 * the word after it ("Neustadt(Wied)") counts as well.
 */
export function findName(name: string, words: readonly TextWord[], limit = 3): TextHit[] {
  const key = keyWord(name)
  if (!key) return []
  const allowed = tolerance(key.length)
  const hits: TextHit[] = []
  for (const word of words) {
    const text = normalizeName(word.text)
    let distance = Math.abs(text.length - key.length) <= allowed ? editDistance(text, key) : Infinity
    if (distance > allowed && key.length >= 5 && text.startsWith(key)) distance = allowed
    if (distance > allowed) continue
    const [left, top, right, bottom] = word.box
    hits.push({ at: [(left + right) / 2, (top + bottom) / 2], distance })
  }
  return hits.sort((a, b) => a.distance - b.distance).slice(0, limit)
}
