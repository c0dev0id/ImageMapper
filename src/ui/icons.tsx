/** Line icons for icon buttons, drawn in the button's text colour. */

/** Show on the map. */
export function CrosshairIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M8 0.5v4M8 11.5v4M0.5 8h4M11.5 8h4" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}

/** Rename. */
export function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M2.5 13.5v-3l8-8 3 3-8 8zM9 4l3 3"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  )
}
