import { createEffect, Show, type JSX } from 'solid-js'
import { countPairs, pinEnabled } from '../gcp/gcps.ts'
import type { Warp } from '../geo/warp.ts'
import { openMatchTowns } from '../match/MatchTownsDialog.tsx'
import { warpOf } from '../state/derived.ts'
import { activeLayer, redo, redoLabel, skewImageToMap, undo, undoLabel } from '../state/project.ts'
import type { ImageLayer, Side } from '../state/schema.ts'
import {
  cancelTapRequest,
  mode,
  selection,
  setTool,
  startTransform,
  stopTransform,
  tool,
  type Tool,
} from '../state/ui.ts'
import {
  AppendIcon,
  CenterOnImageIcon,
  DeleteIcon,
  InsertIcon,
  MatchTownsIcon,
  MoveImageHereIcon,
  PinImageIcon,
  PinMapIcon,
  RedoIcon,
  ResizeIcon,
  SkewIcon,
  UndoIcon,
  WaypointIcon,
} from '../ui/icons.tsx'
import { useMap } from './context.ts'
import { flyToImage, moveImageHere } from './navigate.ts'

/**
 * A toolbar button: an icon over a short caption, with a tooltip that says more. `active`
 * marks the picked tool.
 */
function ToolButton(props: {
  label: string
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: JSX.Element
}) {
  return (
    <button
      class="tool"
      classList={{ active: props.active }}
      title={props.title}
      aria-pressed={props.active === undefined ? undefined : props.active}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.children}
      <span class="tool-label">{props.label}</span>
    </button>
  )
}

/** The tools of the current scope over the map, with undo and redo always at hand. */
export function Toolbar() {
  return (
    <div class="toolbar" role="toolbar" aria-label="Tools">
      <Show when={mode() !== 'route' && activeLayer()} keyed>
        {(layer) => <ImageTools layer={layer} />}
      </Show>
      <Show when={mode() === 'route'}>
        <RouteTools />
      </Show>
      <div class="toolbar-group" role="group" aria-label="History">
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

/** Tools of the active image: pin point pairs and skew; find it, bring it into view or place it by hand. */
function ImageTools(props: { layer: ImageLayer }) {
  const map = useMap()
  const layer = props.layer
  const waiting = () => {
    const s = selection()
    return s?.layerId === layer.id ? s : undefined
  }
  const pairs = () => countPairs(layer.gcps).complete
  const usable = (side: Side) => pinEnabled(side, waiting())

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
      <div class="toolbar-group" role="group" aria-label="Point pairs">
        <ToolButton
          label="Pin Map"
          title="Pin a point on the map, then the same place on the image"
          active={tool() === 'pin-map'}
          disabled={!usable('map')}
          onClick={() => pick('map')}
        >
          <PinMapIcon />
        </ToolButton>
        <ToolButton
          label="Pin Image"
          title="Pin a point on the image, then the same place on the map"
          active={tool() === 'pin-image'}
          disabled={!usable('image')}
          onClick={() => pick('image')}
        >
          <PinImageIcon />
        </ToolButton>
        <ToolButton
          label="Match Towns"
          title="Place the image by towns: search each one, then tap its spot on the image"
          onClick={() => openMatchTowns(layer.id)}
        >
          <MatchTownsIcon />
        </ToolButton>
        <ToolButton
          label="Skew Image"
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
      <div class="toolbar-group" role="group" aria-label="Placement">
        <ToolButton
          label="Center on Image"
          title="Show the whole image"
          onClick={withWarp((warp) => flyToImage(map, warp))}
        >
          <CenterOnImageIcon />
        </ToolButton>
        <ToolButton
          label="Move Image Here"
          title="Move the image to the middle of the view, at the size of a new image"
          onClick={withWarp((warp) => moveImageHere(map, layer, warp))}
        >
          <MoveImageHereIcon />
        </ToolButton>
        <ToolButton
          label="Resize"
          title="Move, rotate and resize the image by hand"
          active={mode() === 'transform'}
          onClick={() => (mode() === 'transform' ? stopTransform() : startTransform())}
        >
          <ResizeIcon />
        </ToolButton>
      </div>
    </>
  )
}

/** Tools of the route being drawn; one of them is always picked. */
function RouteTools() {
  const button = (t: Tool, label: string, title: string, icon: JSX.Element) => (
    <ToolButton
      label={label}
      title={title}
      active={tool() === t}
      onClick={() => {
        cancelTapRequest()
        setTool(t)
      }}
    >
      {icon}
    </ToolButton>
  )
  return (
    <div class="toolbar-group" role="group" aria-label="Route">
      {button('append', 'Append', 'Tap the map to add points at the end of the route', <AppendIcon />)}
      {button('insert', 'Insert', 'Tap the route line to insert a point there', <InsertIcon />)}
      {button(
        'waypoint',
        'Waypoint',
        'Tap the map to place a waypoint: a named place of its own, such as a viewpoint or a warning',
        <WaypointIcon />,
      )}
      {button('delete', 'Delete', 'Tap a route point or a waypoint to delete it', <DeleteIcon />)}
    </div>
  )
}
