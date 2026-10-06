import type { JSX } from 'solid-js'
import { redo, redoLabel, undo, undoLabel } from '../state/project.ts'
import { RedoIcon, UndoIcon } from '../ui/icons.tsx'

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
  return (
    <div class="toolbar" role="toolbar" aria-label="Tools">
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
