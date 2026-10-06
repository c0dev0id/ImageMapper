import { toMercator } from '../geo/mercator.ts'
import type { LngLat, Px } from '../geo/types.ts'
import { fitScale, fitSimilarity, toImage, type Correspondence, type Fit } from './fit.ts'

/** A town as the user picked it: its spot on the image and its place on the map. */
export interface TownPair {
  name: string
  image: Px
  map: LngLat
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
  const residual = (fit: Fit, { image, map }: Correspondence) => {
    const [x, y] = toImage(fit, map)
    return Math.hypot(x - image[0], y - image[1])
  }
  const propose = (fit: Fit): Proposal => {
    const members = pairs.flatMap((pair, i) => (residual(fit, pair) <= TOLERANCE * diagonal ? [i] : []))
    const rms = Math.sqrt(members.reduce((sum, i) => sum + residual(fit, pairs[i]) ** 2, 0) / members.length)
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
      if (proposal.members.length < 2) continue
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
