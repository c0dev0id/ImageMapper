import { createEffect, Show } from 'solid-js'
import { addWaypoint, updateWaypoint } from '../state/project.ts'
import { setWaypointDraft, waypointDraft } from '../state/ui.ts'

/**
 * Name and description of a waypoint, in the browser's modal dialog: Esc or Cancel
 * keeps everything as it was, Save needs a name.
 */
export function WaypointDialog() {
  let dialog!: HTMLDialogElement
  createEffect(() => {
    const open = waypointDraft() !== undefined
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  })
  const save = (form: HTMLFormElement) => {
    const draft = waypointDraft()
    if (!draft) return
    const data = new FormData(form)
    const name = String(data.get('name') ?? '').trim()
    const description = String(data.get('description') ?? '').trim()
    if (!name) return
    if (draft.id) updateWaypoint(draft.id, { name, description }, 'Edit waypoint')
    else addWaypoint({ id: crypto.randomUUID(), lngLat: draft.lngLat, name, ...(description ? { description } : {}) })
    setWaypointDraft(undefined)
  }
  return (
    <dialog ref={dialog} class="dialog" aria-label="Waypoint" onClose={() => setWaypointDraft(undefined)}>
      <Show when={waypointDraft()} keyed>
        {(draft) => (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save(e.currentTarget)
            }}
          >
            <h2>{draft.id ? 'Edit waypoint' : 'New waypoint'}</h2>
            <label>
              Name
              <input name="name" required autofocus value={draft.name} placeholder="Viewpoint, café, gravel ahead…" />
            </label>
            <label>
              Description <span class="muted">(optional)</span>
              <textarea name="description" rows="3" value={draft.description} />
            </label>
            <div class="row end">
              <button type="button" onClick={() => setWaypointDraft(undefined)}>
                Cancel
              </button>
              <button type="submit" class="primary">
                Save
              </button>
            </div>
          </form>
        )}
      </Show>
    </dialog>
  )
}
