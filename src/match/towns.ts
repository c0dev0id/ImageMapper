import { toMercator } from '../geo/mercator.ts'
import type { Pair, Px } from '../geo/types.ts'
import type { Place } from '../search/nominatim.ts'
import { fitScale, fitSimilarity, toImage, type Correspondence, type Fit } from './fit.ts'

/** A town as the user picked it: its spot on the image and its place on the map. */
export interface TownPair extends Pair {
  name: string
}

export interface TownFit {
  /** Image pixels to Web Mercator; undefined when no two towns give a plausible placement. */
  fit?: Fit
  /** Positions of the towns the fit leaves out because they do not fit the others. */
  misfits: number[]
}

/** A town counts as fitting within this share of the image diagonal: printed maps are distorted. */
const TOLERANCE = 0.1
/** Two spots closer than this share of the diagonal say little about scale and rotation. */
const MIN_SPREAD = 0.05
/** Plausible image widths in Mercator units: from about 200 m to a quarter of the world. */
const MIN_WIDTH = 5e-6
const MAX_WIDTH = 0.25

interface Proposal {
  fit: Fit
  /** Positions of the towns that fit. */
  members: number[]
  rms: number
}

/**
 * The similarity transform (rotation, uniform scale, translation) that puts the towns'
 * spots on the image onto their places. One wrong pick must not spoil the placement, so
 * every two towns propose a transform, each proposal is refitted by least squares on the
 * towns that land within the tolerance, and the one most towns agree with wins (ties go
 * to the smaller error). Needs two towns that fit; with exactly two, nothing is checked.
 */
export function fitTowns(towns: readonly TownPair[], width: number, height: number): TownFit {
  const diagonal = Math.hypot(width, height)
  const pairs: Correspondence[] = towns.map((t) => ({ image: t.image, map: toMercator(t.map) }))
  const propose = (fit: Fit): Proposal => {
    const residuals = pairs.map(({ image, map }) => {
      const [x, y] = toImage(fit, map)
      return Math.hypot(x - image[0], y - image[1])
    })
    const members = residuals.flatMap((residual, i) => (residual <= TOLERANCE * diagonal ? [i] : []))
    const rms = Math.sqrt(members.reduce((sum, i) => sum + residuals[i] ** 2, 0) / members.length)
    return { fit, members, rms }
  }

  let best: Proposal | undefined
  for (let a = 0; a < pairs.length; a++) {
    for (let b = a + 1; b < pairs.length; b++) {
      const [p, q] = [pairs[a], pairs[b]]
      if (Math.hypot(p.image[0] - q.image[0], p.image[1] - q.image[1]) < MIN_SPREAD * diagonal) continue
      const fit = fitSimilarity([p, q])
      if (!fit || !plausible(fit, width)) continue
      let proposal = propose(fit)
      const refit = fitSimilarity(proposal.members.map((i) => pairs[i]))
      if (refit && plausible(refit, width)) {
        const again = propose(refit)
        if (again.members.length >= proposal.members.length) proposal = again
      }
      const better =
        !best ||
        proposal.members.length > best.members.length ||
        (proposal.members.length === best.members.length && proposal.rms < best.rms)
      if (better) best = proposal
    }
  }
  if (!best) return { misfits: [] }
  const members = new Set(best.members)
  return { fit: best.fit, misfits: towns.flatMap((_, i) => (members.has(i) ? [] : [i])) }
}

function plausible(fit: Fit, width: number): boolean {
  const span = fitScale(fit) * width
  return span >= MIN_WIDTH && span <= MAX_WIDTH
}

/**
 * A town as the user picks it in the Match Towns dialog: the search for it, the place
 * picked from the results, its spot on the image, and whether the last match left it out.
 */
export interface TownRow {
  term: string
  place?: Place
  image?: Px
  misfit?: boolean
}

/** The towns of the rows that have both a place and a spot, with the positions of those rows. */
export function completeTowns(rows: readonly TownRow[]): { towns: TownPair[]; rows: number[] } {
  const towns: TownPair[] = []
  const at: number[] = []
  rows.forEach((row, i) => {
    if (!row.place || !row.image) return
    towns.push({ name: row.place.name, image: row.image, map: row.place.center })
    at.push(i)
  })
  return { towns, rows: at }
}

/**
 * What a row the user has started still needs: its place, its spot on the image, or a
 * check because the last match left it out. Undefined for untouched and finished rows.
 */
export function rowNote(row: TownRow): 'place' | 'image' | 'fit' | undefined {
  if (!row.term.trim() && !row.place && !row.image) return undefined
  if (!row.place) return 'place'
  if (!row.image) return 'image'
  return row.misfit ? 'fit' : undefined
}
