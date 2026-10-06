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
