import { toMercator } from '../geo/mercator.ts'
import type { LngLat, Merc, Px } from '../geo/types.ts'
import { fitAngle, fitScale, fitSimilarity, toImage, type Fit } from './fit.ts'

/** A town named by the user: where it may be printed on the image and where it may be on the map, best first. */
export interface TownCandidates {
  name: string
  image: Px[]
  map: LngLat[]
}

export interface TownMatch {
  name: string
  image: Px
  map: LngLat
  /** Image pixels between the printed name and where the fit puts the town. */
  residual: number
}

export interface TownMiss {
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

interface Choice {
  town: number
  image: number
  map: number
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
  const mercs = towns.map((t) => t.map.map(toMercator))
  const usable = towns.map((_, i) => i).filter((i) => towns[i].image.length > 0 && towns[i].map.length > 0)

  const evaluate = (fit: Fit): Hypothesis => {
    const choices: Choice[] = []
    for (const town of usable) {
      let best: Choice | undefined
      towns[town].image.forEach((at, image) => {
        mercs[town].forEach((m, map) => {
          const [x, y] = toImage(fit, m)
          const residual = Math.hypot(x - at[0], y - at[1])
          if (!best || residual < best.residual) best = { town, image, map, residual }
        })
      })
      if (best && best.residual <= TOLERANCE * diagonal) choices.push(best)
    }
    const kept = distinct(choices, towns, mercs)
    return { fit, choices: kept, rms: rms(kept) }
  }

  let best: Hypothesis | undefined
  for (let a = 0; a < usable.length; a++) {
    for (let b = a + 1; b < usable.length; b++) {
      const [i, j] = [usable[a], usable[b]]
      for (const imageI of towns[i].image) {
        for (const imageJ of towns[j].image) {
          if (Math.hypot(imageI[0] - imageJ[0], imageI[1] - imageJ[1]) < MIN_SPREAD * diagonal) continue
          for (const mapI of mercs[i]) {
            for (const mapJ of mercs[j]) {
              const fit = fitSimilarity([
                { image: imageI, map: mapI },
                { image: imageJ, map: mapJ },
              ])
              if (!fit || !plausible(fit, width)) continue
              let hypothesis = evaluate(fit)
              if (hypothesis.choices.length < 2) continue
              const refit = fitSimilarity(
                hypothesis.choices.map((c) => ({ image: towns[c.town].image[c.image], map: mercs[c.town][c.map] })),
              )
              if (refit && plausible(refit, width)) {
                const again = evaluate(refit)
                if (again.choices.length >= hypothesis.choices.length) hypothesis = again
              }
              if (!best || better(hypothesis, best)) best = hypothesis
            }
          }
        }
      }
    }
  }
  const choices = best?.choices ?? []
  const matches = choices.map((c) => ({
    name: towns[c.town].name,
    image: towns[c.town].image[c.image],
    map: towns[c.town].map[c.map],
    residual: c.residual,
  }))
  const misses: TownMiss[] = []
  towns.forEach((t, i) => {
    if (choices.some((c) => c.town === i)) return
    misses.push({ name: t.name, reason: t.image.length === 0 ? 'image' : t.map.length === 0 ? 'map' : 'fit' })
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

/** One printed name or one map place cannot stand for two towns; the worse fitting one goes. */
function distinct(choices: Choice[], towns: readonly TownCandidates[], mercs: readonly Merc[][]): Choice[] {
  const kept: Choice[] = []
  for (const c of [...choices].sort((a, b) => a.residual - b.residual)) {
    const image = towns[c.town].image[c.image]
    const map = mercs[c.town][c.map]
    const clash = kept.some((k) => {
      const [ki, km] = [towns[k.town].image[k.image], mercs[k.town][k.map]]
      return (ki[0] === image[0] && ki[1] === image[1]) || (km[0] === map[0] && km[1] === map[1])
    })
    if (!clash) kept.push(c)
  }
  return kept.sort((a, b) => a.town - b.town)
}

function better(a: Hypothesis, b: Hypothesis): boolean {
  if (a.choices.length !== b.choices.length) return a.choices.length > b.choices.length
  if (Math.abs(a.rms - b.rms) > 0.5) return a.rms < b.rms
  const tilt = (h: Hypothesis) => Math.abs(fitAngle(h.fit)) * (180 / Math.PI)
  const upright = (h: Hypothesis) => tilt(h) <= UPRIGHT_DEGREES
  if (upright(a) !== upright(b)) return upright(a)
  const rank = (h: Hypothesis) => h.choices.reduce((sum, c) => sum + c.image + c.map, 0)
  if (rank(a) !== rank(b)) return rank(a) < rank(b)
  return tilt(a) < tilt(b)
}
