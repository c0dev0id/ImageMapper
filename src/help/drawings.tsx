import type { JSX } from 'solid-js'
import { ArrowRightIcon } from '../ui/icons.tsx'

// Schematic drawings for the help: one made-up region as a map shows it and as a magazine
// prints it, in the same 160 × 100 frame, so that the two match where the image fits.

export type Point = [number, number]

const W = 160
const H = 100

const TOWNS: { name: string; at: Point; label: Point; anchor: 'start' | 'end' }[] = [
  { name: 'Altdorf', at: [34, 30], label: [30, 40], anchor: 'end' },
  { name: 'Bergheim', at: [122, 24], label: [117, 19], anchor: 'end' },
  { name: 'Thal', at: [124, 74], label: [129, 71], anchor: 'start' },
  { name: 'Kirchrode', at: [40, 78], label: [45, 88], anchor: 'start' },
]

/** Where the towns are. */
export const TOWN_POINTS: readonly Point[] = TOWNS.map((t) => t.at)

/** The tour: a loop through the four towns on main roads. */
const TOUR = [
  'M34 30 C60 18 92 34 122 24',
  'M122 24 C132 40 116 56 124 74',
  'M124 74 C98 86 70 66 40 78',
  'M40 78 C26 62 46 46 34 30',
]
const ROADS = ['M34 30 C64 44 96 52 124 74', 'M122 24 L160 14', 'M40 78 L0 92', 'M124 74 L160 86', 'M34 30 L22 0']
const RIVER = 'M0 52 C30 46 52 60 80 54 S130 40 160 46'
const LAKE = { cx: 94, cy: 91, rx: 9, ry: 4 }
const FORESTS = [
  'M62 8 C70 2 88 4 92 12 C96 20 82 24 72 21 C62 19 56 13 62 8 Z',
  'M2 60 C8 54 22 56 24 64 C26 72 12 74 6 70 C0 67 -2 63 2 60 Z',
  'M136 40 C144 34 156 38 156 48 C156 58 144 60 138 55 C132 50 130 45 136 40 Z',
]

/** The region as a map shows it: land, forest, water, towns and roads, without labels. */
export function MapDrawing() {
  return (
    <g>
      <rect width={W} height={H} fill="#f2efe9" />
      {FORESTS.map((d) => (
        <path d={d} fill="#c3dba9" />
      ))}
      <path d={RIVER} fill="none" stroke="#9fcbe0" stroke-width="3" />
      <ellipse {...LAKE} fill="#9fcbe0" />
      {TOWNS.map((t) => (
        <rect x={t.at[0] - 8} y={t.at[1] - 5} width="16" height="10" rx="3" fill="#e0dad0" />
      ))}
      <g fill="none" stroke-linecap="round">
        {ROADS.map((d) => (
          <path d={d} stroke="#c9bfb1" stroke-width="2.4" />
        ))}
        {ROADS.map((d) => (
          <path d={d} stroke="#ffffff" stroke-width="1.5" />
        ))}
        {TOUR.map((d) => (
          <path d={d} stroke="#d39a5c" stroke-width="3" />
        ))}
        {TOUR.map((d) => (
          <path d={d} stroke="#fcd6a4" stroke-width="2" />
        ))}
      </g>
    </g>
  )
}

/**
 * The region as a magazine prints it, a little faded as in a photo: paper, pale forest, yellow
 * roads, the tour in red and the town names. `paint` changes its colours.
 */
export function PrintDrawing(props: { paint?: (hex: string) => string }) {
  const p = (hex: string) => (props.paint ? props.paint(hex) : hex)
  return (
    <g>
      <rect width={W} height={H} fill={p('#fbfaf6')} />
      {FORESTS.map((d) => (
        <path d={d} fill={p('#dfe9d3')} />
      ))}
      <path d={RIVER} fill="none" stroke={p('#7aa7cf')} stroke-width="1.2" />
      <ellipse {...LAKE} fill={p('#b9d3ea')} stroke={p('#7aa7cf')} stroke-width="0.6" />
      <g fill="none" stroke-linecap="round">
        {ROADS.map((d) => (
          <path d={d} stroke={p('#8a8578')} stroke-width="2.2" />
        ))}
        {ROADS.map((d) => (
          <path d={d} stroke={p('#ecd77e')} stroke-width="1.3" />
        ))}
        {TOUR.map((d) => (
          <path d={d} stroke={p('#b8434c')} stroke-width="3.6" />
        ))}
      </g>
      {TOWNS.map((t) => (
        <circle cx={t.at[0]} cy={t.at[1]} r="1.8" fill={p('#fbfaf6')} stroke={p('#333333')} stroke-width="0.8" />
      ))}
      <g
        font-family="system-ui, sans-serif"
        font-size="6.5"
        font-weight="700"
        fill={p('#2b2b2b')}
        stroke={p('#fbfaf6')}
        stroke-width="1.6"
        stroke-linejoin="round"
        paint-order="stroke"
      >
        {TOWNS.map((t) => (
          <text x={t.label[0]} y={t.label[1]} text-anchor={t.anchor}>
            {t.name}
          </text>
        ))}
      </g>
    </g>
  )
}

/** The printed map as a photo of the page: a little turned, lying on a grey ground. */
export function PhotoDrawing() {
  return (
    <g>
      <rect width={W} height={H} fill="#dee2e6" />
      <g transform="rotate(-5 80 50) translate(80 50) scale(0.8) translate(-80 -50)">
        <rect x="2.5" y="3.5" width={W} height={H} fill="#000000" opacity="0.18" />
        <PrintDrawing />
      </g>
    </g>
  )
}

/** Route points of the drawn route: the towns and a point on each long leg. */
const ROUTE_POINTS: readonly Point[] = [TOWNS[0].at, [76.5, 26.3], TOWNS[1].at, TOWNS[2].at, [83.5, 76], TOWNS[3].at]

/** The tour traced as a route, drawn as the map draws routes: a coloured line on white, with its points. */
export function RouteDrawing(props: { color: string }) {
  return (
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      {TOUR.map((d) => (
        <path d={d} stroke="#ffffff" stroke-width="3.6" stroke-opacity="0.85" />
      ))}
      {TOUR.map((d) => (
        <path d={d} stroke={props.color} stroke-width="2" />
      ))}
      {ROUTE_POINTS.map((p) => (
        <circle cx={p[0]} cy={p[1]} r="2.6" fill={props.color} stroke="#ffffff" stroke-width="0.9" />
      ))}
    </g>
  )
}

/** A label in the corner: the route as a GPX file. */
export function GpxBadge() {
  return (
    <g>
      <rect x="124" y="5" width="30" height="13" rx="3" fill="#ffffff" stroke="#adb5bd" stroke-width="0.6" />
      <text x="139" y="14.4" text-anchor="middle" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#495057">
        GPX
      </text>
    </g>
  )
}

/** The image point of a pair: a ring, as on the map. */
export function Ring(props: { at: Point }) {
  return (
    <g fill="none">
      <circle cx={props.at[0]} cy={props.at[1]} r="4" stroke="#ffffff" stroke-width="2.6" />
      <circle cx={props.at[0]} cy={props.at[1]} r="4" stroke="#e8590c" stroke-width="1.4" />
    </g>
  )
}

/** The map point of a pair: a dot, as on the map. */
export function Dot(props: { at: Point }) {
  return <circle cx={props.at[0]} cy={props.at[1]} r="2.4" fill="#1c7ed6" stroke="#ffffff" stroke-width="0.8" />
}

/** The dashed line between the image point and the map point of a pair. */
export function Link(props: { from: Point; to: Point }) {
  return (
    <line
      x1={props.from[0]}
      y1={props.from[1]}
      x2={props.to[0]}
      y2={props.to[1]}
      stroke="#e8590c"
      stroke-width="0.9"
      stroke-dasharray="2.5 1.5"
    />
  )
}

/**
 * An image turned by `rotate` degrees, scaled and shifted against the map about the middle of
 * the frame: the SVG transform for the drawing, and where it takes a point of the image.
 */
export function placement(rotate: number, scale: number, shift: Point) {
  const rad = (rotate * Math.PI) / 180
  const a = scale * Math.cos(rad)
  const b = scale * Math.sin(rad)
  const [cx, cy] = [W / 2, H / 2]
  const e = cx + shift[0] - (a * cx - b * cy)
  const f = cy + shift[1] - (b * cx + a * cy)
  return {
    transform: `matrix(${a} ${b} ${-b} ${a} ${e} ${f})`,
    apply: ([x, y]: Point): Point => [a * x - b * y + e, b * x + a * y + f],
  }
}

/** One picture of a banner, with its caption. */
export function Panel(props: { caption: string; children: JSX.Element }) {
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {props.children}
      </svg>
      <figcaption>{props.caption}</figcaption>
    </figure>
  )
}

/** Pictures in a row, from what goes in to what comes out. */
export function Banner(props: { children: JSX.Element }) {
  return <div class="banner">{props.children}</div>
}

/** Between two pictures: the two go together. */
export const Plus = () => (
  <span class="banner-op" aria-hidden="true">
    +
  </span>
)

/** Between two pictures: the first turns into the second. */
export const Then = () => (
  <span class="banner-op" aria-hidden="true">
    <ArrowRightIcon />
  </span>
)
