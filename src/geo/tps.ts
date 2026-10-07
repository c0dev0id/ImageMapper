export type Vec2 = [number, number]
export type Transform = (p: Vec2) => Vec2

/** Thin plate spline radial basis function U(r) = r² log r², written in terms of r². */
function kernel(r2: number): number {
  return r2 === 0 ? 0 : r2 * Math.log(r2)
}

interface Normalisation {
  cx: number
  cy: number
  scale: number
}

/** Centroid and largest deviation, used to keep the linear system well conditioned. */
function normalisation(points: Vec2[]): Normalisation {
  let cx = 0
  let cy = 0
  for (const [x, y] of points) {
    cx += x
    cy += y
  }
  cx /= points.length
  cy /= points.length
  let scale = 0
  for (const [x, y] of points) scale = Math.max(scale, Math.abs(x - cx), Math.abs(y - cy))
  return { cx, cy, scale }
}

/**
 * Fits a thin plate spline that maps every source point exactly onto its destination
 * point. With exactly three points it is the affine transform through them.
 * Throws when the system is singular (fewer than 3 points, duplicate or collinear
 * source points); run {@link checkControlPoints} first for readable messages.
 */
export function fitThinPlateSpline(src: Vec2[], dst: Vec2[]): Transform {
  const n = src.length
  if (n !== dst.length) throw new Error('Source and destination point counts differ.')
  if (n < 3) throw new Error('A thin plate spline needs at least 3 point pairs.')

  const ns = normalisation(src)
  const nd = normalisation(dst)
  if (ns.scale === 0 || nd.scale === 0) throw new Error('Control points are degenerate.')
  const p = src.map(([x, y]): Vec2 => [(x - ns.cx) / ns.scale, (y - ns.cy) / ns.scale])

  // [K P; Pᵀ 0] [w; a] = [v; 0], one right-hand side per output axis.
  const size = n + 3
  const a = Array.from({ length: size }, () => new Array<number>(size).fill(0))
  const b = Array.from({ length: size }, (): Vec2 => [0, 0])
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = p[i][0] - p[j][0]
      const dy = p[i][1] - p[j][1]
      a[i][j] = kernel(dx * dx + dy * dy)
    }
    a[i][n] = a[n][i] = 1
    a[i][n + 1] = a[n + 1][i] = p[i][0]
    a[i][n + 2] = a[n + 2][i] = p[i][1]
    b[i] = [(dst[i][0] - nd.cx) / nd.scale, (dst[i][1] - nd.cy) / nd.scale]
  }
  const x = solve(a, b)

  return ([px, py]) => {
    const u = (px - ns.cx) / ns.scale
    const v = (py - ns.cy) / ns.scale
    let fx = x[n][0] + x[n + 1][0] * u + x[n + 2][0] * v
    let fy = x[n][1] + x[n + 1][1] * u + x[n + 2][1] * v
    for (let i = 0; i < n; i++) {
      const dx = u - p[i][0]
      const dy = v - p[i][1]
      const k = kernel(dx * dx + dy * dy)
      fx += x[i][0] * k
      fy += x[i][1] * k
    }
    return [fx * nd.scale + nd.cx, fy * nd.scale + nd.cy]
  }
}

/** Solves A·X = B (B with two columns) by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: Vec2[]): Vec2[] {
  const n = a.length
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r
    }
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('Control points are degenerate.')
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    ;[b[col], b[pivot]] = [b[pivot], b[col]]
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / a[col][col]
      if (f === 0) continue
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c]
      b[r] = [b[r][0] - f * b[col][0], b[r][1] - f * b[col][1]]
    }
  }
  const x = Array.from({ length: n }, (): Vec2 => [0, 0])
  for (let r = n - 1; r >= 0; r--) {
    let sx = b[r][0]
    let sy = b[r][1]
    for (let c = r + 1; c < n; c++) {
      sx -= a[r][c] * x[c][0]
      sy -= a[r][c] * x[c][1]
    }
    x[r] = [sx / a[r][r], sy / a[r][r]]
  }
  return x
}

/**
 * Checks control points before fitting and returns a readable problem description,
 * or undefined when they are usable. `labels` name the points in messages.
 */
export function checkControlPoints(
  src: Vec2[],
  dst: Vec2[],
  labels: string[],
  minSourceDistance = 1,
): string | undefined {
  if (src.length < 3) return 'At least 3 point pairs are needed.'
  for (let i = 0; i < src.length; i++) {
    for (let j = i + 1; j < src.length; j++) {
      if (Math.hypot(src[i][0] - src[j][0], src[i][1] - src[j][1]) < minSourceDistance) {
        return `Image points ${labels[i]} and ${labels[j]} are at the same spot.`
      }
    }
  }
  if (spreadRatio(src) < 1e-4) {
    return 'The image points lie (almost) on one line. Add a point off to the side.'
  }
  const { cx, cy, scale } = normalisation(dst)
  if (scale <= 1e-12 * Math.max(1, Math.abs(cx), Math.abs(cy))) {
    return 'The map points are all at the same spot.'
  }
  return undefined
}

/** Ratio of the smaller to the larger eigenvalue of the points' covariance (0 = collinear). */
function spreadRatio(points: Vec2[]): number {
  const { cx, cy } = normalisation(points)
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of points) {
    sxx += (x - cx) ** 2
    syy += (y - cy) ** 2
    sxy += (x - cx) * (y - cy)
  }
  const mean = (sxx + syy) / 2
  const diff = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2)
  const large = mean + diff
  return large === 0 ? 0 : (mean - diff) / large
}
