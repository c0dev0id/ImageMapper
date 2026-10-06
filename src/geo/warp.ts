import { fromMercator, mercatorPerPixel, toMercator } from './mercator.ts'
import { transformPlacement } from './similarity.ts'
import { fitThinPlateSpline } from './tps.ts'
import type { LngLat, Merc, Pair, Px } from './types.ts'

/**
 * The geometry of a warped image: a regular grid over the image whose vertices are
 * pushed through a thin plate spline into Web Mercator. The renderer draws exactly
 * this mesh, so mapping points through it (in either direction) matches the screen.
 */
export class Warp {
  readonly cols: number
  readonly rows: number
  /** Mercator x, y per grid vertex, row by row. */
  readonly positions: Float64Array
  /** Texture coordinates per grid vertex. */
  readonly uvs: Float32Array
  /** Two triangles per grid cell, counter-clockwise in image space. */
  readonly indices: Uint16Array | Uint32Array
  /** Mercator position of the image centre; origin for precise rendering. */
  readonly center: Merc
  /** Mercator bounds of the mesh: [minX, minY, maxX, maxY]. */
  readonly bounds: [number, number, number, number]

  constructor(
    pairs: Pair[],
    readonly width: number,
    readonly height: number,
    cellsOnLongSide = 64,
  ) {
    const transform = fitThinPlateSpline(
      pairs.map((p) => p.image),
      pairs.map((p) => toMercator(p.map)),
    )
    const long = Math.max(width, height)
    this.cols = Math.max(1, Math.round((cellsOnLongSide * width) / long))
    this.rows = Math.max(1, Math.round((cellsOnLongSide * height) / long))

    const vertexCount = (this.cols + 1) * (this.rows + 1)
    this.positions = new Float64Array(vertexCount * 2)
    this.uvs = new Float32Array(vertexCount * 2)
    const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
    for (let j = 0; j <= this.rows; j++) {
      for (let i = 0; i <= this.cols; i++) {
        const k = 2 * (j * (this.cols + 1) + i)
        const u = i / this.cols
        const v = j / this.rows
        const [x, y] = transform([u * width, v * height])
        this.positions[k] = x
        this.positions[k + 1] = y
        this.uvs[k] = u
        this.uvs[k + 1] = v
        bounds[0] = Math.min(bounds[0], x)
        bounds[1] = Math.min(bounds[1], y)
        bounds[2] = Math.max(bounds[2], x)
        bounds[3] = Math.max(bounds[3], y)
      }
    }
    this.bounds = bounds

    const IndexArray = vertexCount > 0xffff ? Uint32Array : Uint16Array
    this.indices = new IndexArray(this.cols * this.rows * 6)
    let n = 0
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const a = j * (this.cols + 1) + i
        const b = a + 1
        const c = a + this.cols + 1
        const d = c + 1
        this.indices.set([a, b, c, b, d, c], n)
        n += 6
      }
    }
    this.center = this.imageToMercator([width / 2, height / 2])
  }

  /** Maps an image pixel to the map position where it is drawn. */
  imageToMap(px: Px): LngLat {
    return fromMercator(this.imageToMercator(px))
  }

  /**
   * Maps a map position to the image pixel drawn there, or undefined outside the image.
   * Where the image folds over itself, several pixels lie on the spot; the one drawn last,
   * which is the one on top, is the one seen there.
   */
  mapToImage(lngLat: LngLat): Px | undefined {
    const [mx, my] = toMercator(lngLat)
    const [minX, minY, maxX, maxY] = this.bounds
    if (mx < minX || mx > maxX || my < minY || my > maxY) return undefined
    const pos = this.positions
    const eps = 1e-9
    for (let t = this.indices.length - 3; t >= 0; t -= 3) {
      const i0 = 2 * this.indices[t]
      const i1 = 2 * this.indices[t + 1]
      const i2 = 2 * this.indices[t + 2]
      const x0 = pos[i0]
      const y0 = pos[i0 + 1]
      const x1 = pos[i1]
      const y1 = pos[i1 + 1]
      const x2 = pos[i2]
      const y2 = pos[i2 + 1]
      const det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
      if (det === 0) continue
      const l0 = ((y1 - y2) * (mx - x2) + (x2 - x1) * (my - y2)) / det
      const l1 = ((y2 - y0) * (mx - x2) + (x0 - x2) * (my - y2)) / det
      const l2 = 1 - l0 - l1
      if (l0 < -eps || l1 < -eps || l2 < -eps) continue
      const u = l0 * this.uvs[i0] + l1 * this.uvs[i1] + l2 * this.uvs[i2]
      const v = l0 * this.uvs[i0 + 1] + l1 * this.uvs[i1 + 1] + l2 * this.uvs[i2 + 1]
      return [u * this.width, v * this.height]
    }
    return undefined
  }

  /** The image border as drawn, clockwise from the top-left corner, as a closed ring. */
  outline(): LngLat[] {
    const vertex = (i: number, j: number): LngLat => {
      const k = 2 * (j * (this.cols + 1) + i)
      return fromMercator([this.positions[k], this.positions[k + 1]])
    }
    const ring: LngLat[] = []
    for (let i = 0; i < this.cols; i++) ring.push(vertex(i, 0))
    for (let j = 0; j < this.rows; j++) ring.push(vertex(this.cols, j))
    for (let i = this.cols; i > 0; i--) ring.push(vertex(i, this.rows))
    for (let j = this.rows; j > 0; j--) ring.push(vertex(0, j))
    ring.push(ring[0])
    return ring
  }

  /** Counts mesh triangles whose orientation is reversed on the map (folds or a mirror). */
  countFlippedTriangles(): { flipped: number; total: number } {
    const pos = this.positions
    let flipped = 0
    for (let t = 0; t < this.indices.length; t += 3) {
      const a = 2 * this.indices[t]
      const b = 2 * this.indices[t + 1]
      const c = 2 * this.indices[t + 2]
      // Image and Mercator are both y-down, so a faithful warp keeps the sign positive.
      const area =
        (pos[b] - pos[a]) * (pos[c + 1] - pos[a + 1]) - (pos[b + 1] - pos[a + 1]) * (pos[c] - pos[a])
      if (area <= 0) flipped++
    }
    return { flipped, total: this.indices.length / 3 }
  }

  /** Mercator position of an image pixel via the triangle that contains it in the grid. */
  private imageToMercator([x, y]: Px): Merc {
    const fx = (x / this.width) * this.cols
    const fy = (y / this.height) * this.rows
    const i = Math.min(Math.max(Math.floor(fx), 0), this.cols - 1)
    const j = Math.min(Math.max(Math.floor(fy), 0), this.rows - 1)
    const u = fx - i
    const v = fy - j
    const a = 2 * (j * (this.cols + 1) + i)
    const b = a + 2
    const c = a + 2 * (this.cols + 1)
    const d = c + 2
    const pos = this.positions
    // Same split as the index buffer: (a, b, c) below the diagonal, (b, d, c) above it.
    const [wa, wb, wc, wd] = u + v <= 1 ? [1 - u - v, u, v, 0] : [0, 1 - v, 1 - u, u + v - 1]
    return [
      wa * pos[a] + wb * pos[b] + wc * pos[c] + wd * pos[d],
      wa * pos[a + 1] + wb * pos[b + 1] + wc * pos[c + 1] + wd * pos[d + 1],
    ]
  }
}

/** Share of the canvas an image covers when it is placed in the view. */
const VIEW_FILL = 0.6

/**
 * Placement for a newly added image: north-up, centred on the view, scaled so it covers
 * `fill` of the canvas. Uses centre and zoom rather than the visible bounds, which reach
 * the horizon when the map is pitched.
 */
export function initialPlacement(
  width: number,
  height: number,
  center: LngLat,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  fill = VIEW_FILL,
): Pair[] {
  const screenPerImagePx = fill * Math.min(canvasWidth / width, canvasHeight / height)
  const scale = screenPerImagePx * mercatorPerPixel(zoom)
  const [cx, cy] = toMercator(center)
  const corners: Px[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ]
  return corners.map((image) => ({
    image,
    map: fromMercator([cx + (image[0] - width / 2) * scale, cy + (image[1] - height / 2) * scale]),
  }))
}

/**
 * Moves a placed image to the centre of the view and scales it to cover `fill` of the
 * canvas, like a new image, but keeps its rotation and bends.
 */
export function placementInView(
  pairs: readonly Pair[],
  warp: Pick<Warp, 'center' | 'bounds'>,
  center: LngLat,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  fill = VIEW_FILL,
): Pair[] {
  const [minX, minY, maxX, maxY] = warp.bounds
  const perPixel = mercatorPerPixel(zoom)
  const scale = fill * Math.min((canvasWidth * perPixel) / (maxX - minX), (canvasHeight * perPixel) / (maxY - minY))
  const [x, y] = toMercator(center)
  return transformPlacement(pairs, { pivot: warp.center, scale, translate: [x - warp.center[0], y - warp.center[1]] })
}
