import type { JSX } from 'solid-js'

/** Line icons for buttons, drawn in the button's text colour on a 16 × 16 grid. */
function Icon(props: { children: JSX.Element }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  )
}

/** Show on the map. */
export const CrosshairIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="4.5" />
    <path d="M8 0.5v4M8 11.5v4M0.5 8h4M11.5 8h4" />
  </Icon>
)

/** Rename. */
export const PencilIcon = () => (
  <Icon>
    <path d="M2.5 13.5v-3l8-8 3 3-8 8zM9 4l3 3" />
  </Icon>
)

export const UndoIcon = () => (
  <Icon>
    <path d="M5.5 3 2.5 6l3 3" />
    <path d="M2.5 6h7a4 4 0 0 1 0 8H7" />
  </Icon>
)

export const RedoIcon = () => (
  <Icon>
    <path d="m10.5 3 3 3-3 3" />
    <path d="M13.5 6h-7a4 4 0 0 0 0 8H9" />
  </Icon>
)

/** Pin a point on the map (the map side of a pair is a dot). */
export const PinMapIcon = () => (
  <Icon>
    <path d="M8 14.5s-4.5-4.4-4.5-8a4.5 4.5 0 0 1 9 0c0 3.6-4.5 8-4.5 8z" />
    <circle cx="8" cy="6.5" r="1.5" fill="currentColor" />
  </Icon>
)

/** Pin a point on the image (the image side of a pair is a ring). */
export const PinImageIcon = () => (
  <Icon>
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
    <circle cx="8" cy="8" r="2.5" />
  </Icon>
)

/** Move, rotate and resize: a frame with corner handles. */
export const TransformIcon = () => (
  <Icon>
    <rect x="3.5" y="3.5" width="9" height="9" stroke-dasharray="2 1.5" />
    <path d="M1.5 1.5h3v3h-3zM11.5 1.5h3v3h-3zM11.5 11.5h3v3h-3zM1.5 11.5h3v3h-3z" fill="currentColor" stroke="none" />
  </Icon>
)

/** Skew the image to its point pairs. */
export const SkewIcon = () => (
  <Icon>
    <path d="M5 3h9l-3 10H2z" />
    <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
  </Icon>
)

/** Bring into view: a picture between the corners of the view. */
export const MoveHereIcon = () => (
  <Icon>
    <path d="M1.5 5V1.5H5M11 1.5h3.5V5M14.5 11v3.5H11M5 14.5H1.5V11" />
    <rect x="5.5" y="5.5" width="5" height="5" rx="1" />
  </Icon>
)

/** Append points: a route ending in a plus. */
export const AppendIcon = () => (
  <Icon>
    <path d="M1.5 13.5 5 9l3.5 2" />
    <path d="M12 3v7M8.5 6.5h7" />
  </Icon>
)

/** Insert a point: a plus above a line. */
export const InsertIcon = () => (
  <Icon>
    <path d="M1.5 13.5h13" />
    <path d="M8 2.5v7M4.5 6h7" />
  </Icon>
)

/** Delete: a bin. */
export const DeleteIcon = () => (
  <Icon>
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 7v4M9.5 7v4" />
  </Icon>
)

/** The map pin of a waypoint; its tip marks the place. */
export function WaypointPin() {
  return (
    <svg viewBox="0 0 22 28" width="22" height="28" aria-hidden="true">
      <path
        d="M11 27s-9.5-9.2-9.5-15.6a9.5 9.5 0 0 1 19 0C20.5 17.8 11 27 11 27z"
        fill="#c92a2a"
        stroke="#fff"
        stroke-width="1.5"
      />
      <circle cx="11" cy="11" r="3.5" fill="#fff" />
    </svg>
  )
}
