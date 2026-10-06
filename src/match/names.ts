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

/** A word with letters in it, with stray punctuation at its ends removed ("‚Maulsbach:" → "Maulsbach"). */
function cleanWord(text: string): string {
  return /\p{L}/u.test(text) ? text.replace(/^[^\p{L}(]+|[^\p{L})]+$/gu, '') : ''
}

/**
 * The name printed where the user tapped: the word under the tap (or within half its
 * height of it), joined with the words beside it on the same printed line, such as "Bad
 * Marienberg" or "Neustadt (Wied)". Undefined when no word was read there.
 */
export function labelAt(words: readonly TextWord[], [x, y]: Px): { text: string; at: Px } | undefined {
  const lettered = words.map((w) => ({ ...w, text: cleanWord(w.text) })).filter((w) => w.text)
  let hit: TextWord | undefined
  let nearest = Infinity
  for (const word of lettered) {
    const [left, top, right, bottom] = word.box
    const distance = Math.hypot(Math.max(left - x, 0, x - right), Math.max(top - y, 0, y - bottom))
    if (distance <= (bottom - top) / 2 && distance < nearest) {
      hit = word
      nearest = distance
    }
  }
  if (!hit) return undefined

  // Words of the same line: about the same height, overlapping vertically, close by.
  const height = hit.box[3] - hit.box[1]
  const sameLine = (w: TextWord) => {
    const h = w.box[3] - w.box[1]
    const overlap = Math.min(w.box[3], hit.box[3]) - Math.max(w.box[1], hit.box[1])
    return h > height * 0.6 && h < height * 1.6 && overlap > Math.min(h, height) / 2
  }
  const line = lettered.filter(sameLine).sort((a, b) => a.box[0] - b.box[0])
  let first = line.indexOf(hit)
  let last = first
  while (first > 0 && line[first].box[0] - line[first - 1].box[2] <= height) first--
  while (last < line.length - 1 && line[last + 1].box[0] - line[last].box[2] <= height) last++
  const group = line.slice(first, last + 1)
  const left = Math.min(...group.map((w) => w.box[0]))
  const top = Math.min(...group.map((w) => w.box[1]))
  const right = Math.max(...group.map((w) => w.box[2]))
  const bottom = Math.max(...group.map((w) => w.box[3]))
  return { text: group.map((w) => w.text).join(' '), at: [(left + right) / 2, (top + bottom) / 2] }
}
