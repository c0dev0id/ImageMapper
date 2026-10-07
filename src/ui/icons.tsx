// Shapes drawn from or composed of Tabler Icons (https://tabler.io/icons).
// Copyright (c) 2020-2026 Paweł Kuna, MIT License: see tabler-icons-license.txt.
import type { JSX } from 'solid-js'

/**
 * Line icons on Tabler's 24 × 24 grid, drawn in the text colour. Related tools share a base
 * and differ in a badge: a pin on a map or on a picture, an arrow into or out of a picture.
 */
function Icon(props: { children: JSX.Element }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  )
}

/** A map pin in the bottom right corner (Tabler's badge). */
const PinBadge = () => (
  <>
    <path d="M21.121 20.121a3 3 0 1 0 -4.242 0c.418 .419 1.125 1.045 2.121 1.879c1.051 -.89 1.759 -1.516 2.121 -1.879" />
    <path d="M19 18v.01" />
  </>
)

/** A picture whose bottom right corner is left open for an arrow (Tabler's photo-share). */
const PictureWithCorner = () => (
  <>
    <path d="M15 8h.01" />
    <path d="M12 21h-6a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v7" />
    <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l3 3" />
    <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0" />
  </>
)

/** Pin a point pair, starting on the image: a picture with a pin (Tabler's photo-pin). */
export const PinImageIcon = () => (
  <Icon>
    <path d="M15 8h.01" />
    <path d="M12.5 21h-6.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5.5" />
    <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l2.5 2.5" />
    <PinBadge />
  </Icon>
)

/** Match towns: a picture with a magnifier, for towns searched and found on it (Tabler's photo-search). */
export const MatchTownsIcon = () => (
  <Icon>
    <path d="M15 8h.01" />
    <path d="M11.5 21h-5.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5.5" />
    <path d="M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M20.2 20.2l1.8 1.8" />
    <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l2 2" />
  </Icon>
)

/** Skew the image: an image point (ring) moves onto its map point (dot). */
export const SkewIcon = () => (
  <Icon>
    <circle cx="5" cy="17" r="3" />
    <path d="M6 12a7 7 0 0 1 9 -6" />
    <path d="M12.5 3.5l2.5 2.5l-2.5 2.5" />
    <circle cx="19" cy="7" r="2" fill="currentColor" />
  </Icon>
)

/** Center the view on the image: an arrow pointing into the picture. */
export const CenterOnImageIcon = () => (
  <Icon>
    <PictureWithCorner />
    <path d="M16 16l5 5" />
    <path d="M16 20.5v-4.5h4.5" />
  </Icon>
)

/** Move the image into the view: an arrow pointing out of the picture. */
export const MoveImageHereIcon = () => (
  <Icon>
    <PictureWithCorner />
    <path d="M16 16l5 5" />
    <path d="M21 16.5v4.5h-4.5" />
  </Icon>
)

/** Move, rotate and resize the image: a picture in a frame with handles (after Tabler's vector). */
export const ResizeIcon = () => (
  <Icon>
    <path d="M3 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" />
    <path d="M17 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" />
    <path d="M17 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" />
    <path d="M3 18a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -2" />
    <path d="M5 7l0 10" />
    <path d="M19 7l0 10" />
    <path d="M7 5l10 0" />
    <path d="M7 19l10 0" />
    <path d="M8 15l2.5 -2.5c.6 -.6 1.4 -.6 2 0l2.5 2.5" />
    <path d="M14.5 9h.01" />
  </Icon>
)

/** Undo (Tabler's arrow-back-up). */
export const UndoIcon = () => (
  <Icon>
    <path d="M9 14l-4 -4l4 -4" />
    <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
  </Icon>
)

/** Redo (Tabler's arrow-forward-up). */
export const RedoIcon = () => (
  <Icon>
    <path d="M15 14l4 -4l-4 -4" />
    <path d="M19 10h-11a4 4 0 1 0 0 8h1" />
  </Icon>
)

/** Append route points: a line of points with a plus at its end. */
export const AppendIcon = () => (
  <Icon>
    <circle cx="4" cy="20" r="2" />
    <path d="M5.5 18.5l3 -3" />
    <circle cx="10" cy="14" r="2" />
    <path d="M17.5 2.5v8" />
    <path d="M13.5 6.5h8" />
  </Icon>
)

/** Insert a route point: a line between two points with a plus in its middle. */
export const InsertIcon = () => (
  <Icon>
    <circle cx="4" cy="20" r="2" />
    <circle cx="20" cy="4" r="2" />
    <path d="M5.5 18.5l2 -2" />
    <path d="M16.5 7.5l2 -2" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </Icon>
)

/** Add a waypoint: a map pin with a plus (Tabler's map-pin-plus). */
export const WaypointIcon = () => (
  <Icon>
    <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    <path d="M12.794 21.322a2 2 0 0 1 -2.207 -.422l-4.244 -4.243a8 8 0 1 1 13.59 -4.616" />
    <path d="M16 19h6" />
    <path d="M19 16v6" />
  </Icon>
)

/** Delete (Tabler's trash). */
export const DeleteIcon = () => (
  <Icon>
    <path d="M4 7l16 0" />
    <path d="M10 11l0 6" />
    <path d="M14 11l0 6" />
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
  </Icon>
)

/** Show on the map (Tabler's focus-2). */
export const CrosshairIcon = () => (
  <Icon>
    <path d="M11.5 12a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0" fill="currentColor" />
    <path d="M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
    <path d="M12 3l0 2" />
    <path d="M3 12l2 0" />
    <path d="M12 19l0 2" />
    <path d="M19 12l2 0" />
  </Icon>
)

/** Rename (Tabler's pencil). */
export const PencilIcon = () => (
  <Icon>
    <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
)

/** Shown (Tabler's eye). */
export const EyeIcon = () => (
  <Icon>
    <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
  </Icon>
)

/** Hidden (Tabler's eye-off). */
export const EyeOffIcon = () => (
  <Icon>
    <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
    <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
    <path d="M3 3l18 18" />
  </Icon>
)

/** Explain what a setting or tool does (Tabler's help-circle). */
export const HelpIcon = () => (
  <Icon>
    <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
    <path d="M12 16v.01" />
    <path d="M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483" />
  </Icon>
)

/** One thing turns into the next (Tabler's arrow-right). */
export const ArrowRightIcon = () => (
  <Icon>
    <path d="M5 12l14 0" />
    <path d="M13 18l6 -6" />
    <path d="M13 6l6 6" />
  </Icon>
)

/** A handle to drag a list item (Tabler's grip-vertical). */
export const GripIcon = () => (
  <Icon>
    <path d="M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    <path d="M14 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
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
