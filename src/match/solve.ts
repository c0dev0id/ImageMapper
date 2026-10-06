import { toMercator } from '../geo/mercator.ts'
import type { LngLat, Merc, Px } from '../geo/types.ts'
import { fitAngle, fitScale, fitSimilarity, toImage, type Fit } from './fit.ts'

/** A town named by the user: where it may be printed on the image and where it may be on the map, best first. */
export interface TownCandidates {
  name: string
  image: Px[]
  map: LngLat[]
}

/** A town placed by the fit; `index` is its position in the towns given to the solver. */
export interface TownMatch {
  index: number
  name: string
  image: Px
  map: LngLat
}

/** A town the fit leaves out, and why; `index` as for a match. */
export interface TownMiss {
  index: number
  name: string
  /** Not read on the image, not found on the map, or found but not fitting the others. */
  reason: 'image' | 'map' | 'fit'
}

export interface TownSolution {
  /** Image pixels to Web Mercator; undefined when fewer than two towns agree. */
  fit?: Fit
  matches: TownMatch[]
  misses: TownMiss[]
}

/** A town counts as fitting within this share of the image diagonal: printed maps are distorted. */
const TOLERANCE = 0.1
/** Two towns closer than this share of the diagonal say little about scale and rotation. */
const MIN_SPREAD = 0.05
/** Plausible image widths in Mercator units: from about 200 m to a quarter of the world. */
const MIN_WIDTH = 5e-6
const MAX_WIDTH = 0.25
/** Rotations up to this many degrees count as upright when nothing else decides. */
const UPRIGHT_DEGREES = 20

/** One way to place a town: one of its printed names and one of its map places. */
interface Option {
  town: number
  image: Px
  map: Merc
  lngLat: LngLat
  /** How far down both candidate lists this option is; 0 for the best read and place. */
  rank: number
}

interface Choice extends Option {
  /** Image pixels between the printed name and where the fit puts the place. */
  residual: number
}

interface Hypothesis {
  fit: Fit
  choices: Choice[]
  rms: number
}

/**
 * Picks for each town one place on the image and one on the map so that as many towns
 * as possible agree on one similarity transform (rotation, uniform scale, translation).
 * Every pair of towns proposes a transform; each proposal is scored by the towns that
 * land near their printed names, refitted on those and scored again. Ties go to the
 * smaller error, then to upright maps, then to the better-ranked candidates. Needs two
 * towns that fit; with exactly two, nothing can be checked.
 */
export function solveTowns(towns: readonly TownCandidates[], width: number, height: number): TownSolution {
  const diagonal = Math.hypot(width, height)
  const options: Option[][] = towns.map((town, index) =>
    town.image.flatMap((image, i) =>
      town.map.map((lngLat, m) => ({ town: index, image, map: toMercator(lngLat), lngLat, rank: i + m })),
    ),
  )

  const evaluate = (fit: Fit): Hypothesis => {
    const choices: Choice[] = []
    for (const list of options) {
      let best: Choice | undefined
      for (const option of list) {
        const [x, y] = toImage(fit, option.map)
        const residual = Math.hypot(x - option.image[0], y - option.image[1])
        if (!best || residual < best.residual) best = { ...option, residual }
      }
      if (best && best.residual <= TOLERANCE * diagonal) choices.push(best)
    }
    const kept = distinct(choices)
    return { fit, choices: kept, rms: rms(kept) }
  }

  let best: Hypothesis | undefined
  for (let a = 0; a < options.length; a++) {
    for (let b = a + 1; b < options.length; b++) {
      for (const p of options[a]) {
        for (const q of options[b]) {
          if (Math.hypot(p.image[0] - q.image[0], p.image[1] - q.image[1]) < MIN_SPREAD * diagonal) continue
          const fit = fitSimilarity([p, q])
          if (!fit || !plausible(fit, width)) continue
          let hypothesis = evaluate(fit)
          if (hypothesis.choices.length < 2) continue
          const refit = fitSimilarity(hypothesis.choices)
          if (refit && plausible(refit, width)) {
            const again = evaluate(refit)
            if (again.choices.length >= hypothesis.choices.length) hypothesis = again
          }
          if (!best || better(hypothesis, best)) best = hypothesis
        }
      }
    }
  }
  const choices = best?.choices ?? []
  const matches = choices.map((c) => ({ index: c.town, name: towns[c.town].name, image: c.image, map: c.lngLat }))
  const misses: TownMiss[] = []
  towns.forEach((t, index) => {
    if (choices.some((c) => c.town === index)) return
    misses.push({ index, name: t.name, reason: t.image.length === 0 ? 'image' : t.map.length === 0 ? 'map' : 'fit' })
  })
  return { fit: best?.fit, matches, misses }
}

function plausible(fit: Fit, width: number): boolean {
  const span = fitScale(fit) * width
  return span >= MIN_WIDTH && span <= MAX_WIDTH
}

function rms(choices: readonly Choice[]): number {
  return choices.length ? Math.sqrt(choices.reduce((sum, c) => sum + c.residual ** 2, 0) / choices.length) : 0
}

const same = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1]

/** One printed name or one map place cannot stand for two towns; the worse fitting one goes. */
function distinct(choices: readonly Choice[]): Choice[] {
  const kept: Choice[] = []
  for (const c of [...choices].sort((a, b) => a.residual - b.residual)) {
    if (!kept.some((k) => same(k.image, c.image) || same(k.map, c.map))) kept.push(c)
  }
  return kept.sort((a, b) => a.town - b.town)
}

function better(a: Hypothesis, b: Hypothesis): boolean {
  if (a.choices.length !== b.choices.length) return a.choices.length > b.choices.length
  if (Math.abs(a.rms - b.rms) > 0.5) return a.rms < b.rms
  const tilt = (h: Hypothesis) => Math.abs(fitAngle(h.fit)) * (180 / Math.PI)
  const upright = (h: Hypothesis) => tilt(h) <= UPRIGHT_DEGREES
  if (upright(a) !== upright(b)) return upright(a)
  const rank = (h: Hypothesis) => h.choices.reduce((sum, c) => sum + c.rank, 0)
  if (rank(a) !== rank(b)) return rank(a) < rank(b)
  return tilt(a) < tilt(b)
}
