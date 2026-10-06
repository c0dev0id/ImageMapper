import { createEffect, Show, type JSX } from 'solid-js'
import { countPairs, pinEnabled } from '../gcp/gcps.ts'
import type { Warp } from '../geo/warp.ts'
import { warpOf } from '../state/derived.ts'
import { activeLayer, redo, redoLabel, skewImageToMap, undo, undoLabel } from '../state/project.ts'
import type { ImageLayer, Side } from '../state/schema.ts'
import { mode, selection, setTool, startTransform, stopTransform, tool } from '../state/ui.ts'
import {
  CrosshairIcon,
  MoveHereIcon,
  PinImageIcon,
  PinMapIcon,
  RedoIcon,
  SkewIcon,
  TransformIcon,
  UndoIcon,
} from '../ui/icons.tsx'
import { useMap } from './context.ts'
import { flyToImage, moveImageHere } from './navigate.ts'

/** A toolbar button: an icon with a descriptive tooltip; `active` marks the picked tool. */
export function ToolButton(props: {
  label: string
  title?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: JSX.Element
}) {
  return (
    <button
      class="tool"
      classList={{ active: props.active }}
      title={props.title ?? props.label}
      aria-label={props.label}
      aria-pressed={props.active === undefined ? undefined : props.active}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  )
}

/** The tools of the current scope over the map, with undo and redo always at hand. */
export function Toolbar() {
  const map = useMap()
  // The map shows a crosshair while a tool waits for a tap.
  createEffect(() => map.getContainer().classList.toggle('tool-active', tool() !== undefined))
  return (
    <div class="toolbar" role="toolbar" aria-label="Tools">
      <Show when={mode() !== 'route' && activeLayer()} keyed>
        {(layer) => <ImageTools layer={layer} />}
      </Show>
      <div class="toolbar-group">
        <ToolButton
          label="Undo"
          title={undoLabel() ? `Undo: ${undoLabel()} (Ctrl+Z)` : 'Nothing to undo'}
          disabled={!undoLabel()}
          onClick={undo}
        >
          <UndoIcon />
        </ToolButton>
        <ToolButton
          label="Redo"
          title={redoLabel() ? `Redo: ${redoLabel()} (Ctrl+Shift+Z)` : 'Nothing to redo'}
          disabled={!redoLabel()}
          onClick={redo}
        >
          <RedoIcon />
        </ToolButton>
      </div>
    </div>
  )
}

/** Tools of the active image: pin point pairs, place it by hand, skew it, find it. */
function ImageTools(props: { layer: ImageLayer }) {
  const map = useMap()
  const layer = props.layer
  const waiting = () => {
    const s = selection()
    return s?.layerId === layer.id ? s : undefined
  }
  const pairs = () => countPairs(layer.gcps).complete
  const usable = (side: Side) => pinEnabled(side, waiting()) && (side === 'map' || layer.visible)

  // The picked pin always belongs to a side that can take the next point.
  createEffect(() => {
    const t = tool()
    if (t === 'pin-map' && !usable('map')) setTool(usable('image') ? 'pin-image' : undefined)
    else if (t === 'pin-image' && !usable('image')) setTool(usable('map') ? 'pin-map' : undefined)
  })
  const pick = (side: Side) => {
    stopTransform()
    setTool((t) => (t === `pin-${side}` ? undefined : `pin-${side}`))
  }
  const withWarp = (action: (warp: Warp) => void) => () => {
    const warp = warpOf(layer.id)
    if (warp) action(warp)
  }

  return (
    <>
      <div class="toolbar-group">
        <ToolButton
          label="Pin on map"
          title="Pin a point on the map, then the same place on the image"
          active={tool() === 'pin-map'}
          disabled={!usable('map')}
          onClick={() => pick('map')}
        >
          <PinMapIcon />
        </ToolButton>
        <ToolButton
          label="Pin on image"
          title="Pin a point on the image, then the same place on the map"
          active={tool() === 'pin-image'}
          disabled={!usable('image')}
          onClick={() => pick('image')}
        >
          <PinImageIcon />
        </ToolButton>
        <ToolButton
          label="Move, rotate, resize"
          title="Move, rotate and resize the image by hand"
          active={mode() === 'transform'}
          disabled={!layer.visible}
          onClick={() => (mode() === 'transform' ? stopTransform() : startTransform())}
        >
          <TransformIcon />
        </ToolButton>
        <ToolButton
          label="Skew image to map"
          title={
            pairs() >= 3
              ? `Skew the image so that its ${pairs()} point pairs match`
              : 'Skew the image to the map: needs 3 point pairs'
          }
          disabled={pairs() < 3}
          onClick={() => skewImageToMap(layer.id)}
        >
          <SkewIcon />
        </ToolButton>
      </div>
      <div class="toolbar-group">
        <ToolButton label="Fly to image" title="Show the whole image" onClick={withWarp((warp) => flyToImage(map, warp))}>
          <CrosshairIcon />
        </ToolButton>
        <ToolButton
          label="Move image here"
          title="Move the image to the middle of the view, at the size of a new image"
          onClick={withWarp((warp) => moveImageHere(map, layer, warp))}
        >
          <MoveHereIcon />
        </ToolButton>
      </div>
    </>
  )
}
