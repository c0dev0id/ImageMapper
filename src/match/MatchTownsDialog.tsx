import { createEffect, createSignal, For, Show } from 'solid-js'
import { useMapAccessor } from '../map/context.ts'
import { errorMessage } from '../state/ui.ts'
import { matchTowns, type MatchProgress } from './matchTowns.ts'
import { describeSolution } from './report.ts'

const FIELDS = [0, 1, 2, 3]

/** The layer the dialog works on while it is open. */
const [layerId, setLayerId] = createSignal<string>()

/** Names typed per layer in this session, so that a second try starts from the first. */
const namesByLayer = new Map<string, string[]>()

export function openMatchTowns(id: string): void {
  setLayerId(id)
}

/**
 * Asks for up to four towns printed on the image and places the image by them. It stays
 * open with an explanation when fewer than two towns could be matched; Cancel or Esc also
 * stops a match in progress.
 */
export function MatchTownsDialog() {
  const map = useMapAccessor()
  let dialog!: HTMLDialogElement
  let running: AbortController | undefined
  const [progress, setProgress] = createSignal<MatchProgress>()
  const [message, setMessage] = createSignal<string>()

  createEffect(() => {
    const open = layerId() !== undefined
    if (open && !dialog.open) {
      setMessage(undefined)
      dialog.showModal()
    } else if (!open && dialog.open) dialog.close()
  })

  const close = () => {
    running?.abort()
    running = undefined
    setProgress(undefined)
    setLayerId(undefined)
  }

  const submit = async (form: HTMLFormElement) => {
    const id = layerId()
    const m = map()
    if (!id || !m || running) return
    const data = new FormData(form)
    const typed = FIELDS.map((i) => String(data.get(`town${i}`) ?? '').trim())
    namesByLayer.set(id, typed)
    const names = [...new Set(typed.filter(Boolean))]
    if (names.length < 2) {
      setMessage('Name at least two towns.')
      return
    }
    const controller = new AbortController()
    running = controller
    setMessage(undefined)
    try {
      const solution = await matchTowns(m, id, names, setProgress, controller.signal)
      if (solution.fit) close()
      else setMessage(describeSolution(solution))
    } catch (error) {
      if (!controller.signal.aborted) setMessage(errorMessage(error))
    } finally {
      if (running === controller) running = undefined
      setProgress(undefined)
    }
  }

  const status = () => {
    const p = progress()
    if (!p) return undefined
    const parts: string[] = []
    if (p.reading?.stage === 'loading') parts.push('Loading text recognition…')
    if (p.reading?.stage === 'reading') parts.push(`Reading the image… ${Math.round((p.reading.share ?? 0) * 100)} %`)
    if (p.lookedUp < p.total) parts.push(`Looking up towns… ${p.lookedUp} of ${p.total}`)
    return parts.join(' · ') || 'Matching…'
  }

  return (
    <dialog ref={dialog} class="dialog" aria-label="Match towns" onClose={close}>
      <Show when={layerId()} keyed>
        {(id) => (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit(e.currentTarget)
            }}
          >
            <h2>Match towns</h2>
            <p class="muted hint">
              Name towns printed on the image, as far apart as possible. They are looked for on the image and on the
              map; the image is placed by them and each becomes a point pair.
            </p>
            <div class="town-fields">
              <For each={FIELDS}>
                {(i) => (
                  <input
                    name={`town${i}`}
                    aria-label={`Town ${i + 1}`}
                    placeholder={`Town ${i + 1}`}
                    autocomplete="off"
                    value={namesByLayer.get(id)?.[i] ?? ''}
                    disabled={progress() !== undefined}
                  />
                )}
              </For>
            </div>
            <Show when={status()}>{(text) => <p role="status">{text()}</p>}</Show>
            <Show when={message()}>{(text) => <p class="note warning">{text()}</p>}</Show>
            <div class="row end">
              <button type="button" onClick={close}>
                Cancel
              </button>
              <button type="submit" class="primary" disabled={progress() !== undefined}>
                Match
              </button>
            </div>
          </form>
        )}
      </Show>
    </dialog>
  )
}
