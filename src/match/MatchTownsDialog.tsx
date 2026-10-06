import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { createStore, unwrap } from 'solid-js/store'
import { useMapAccessor } from '../map/context.ts'
import { searchViewbox } from '../map/navigate.ts'
import { searchPlaces, type Place } from '../search/nominatim.ts'
import { errorMessage } from '../state/ui.ts'
import { FindPlaceIcon } from '../ui/icons.tsx'
import { matchTowns, type MatchProgress, type TownInput } from './matchTowns.ts'
import { describeSolution } from './report.ts'

/** A name as printed on the image, and the place on the map if the user picked one. */
interface TownRow {
  label: string
  place?: Place
}

const ROWS = 4

/** The layer the dialog works on while it is open. */
const [layerId, setLayerId] = createSignal<string>()

/** Rows per layer in this session, so that a second try starts from the first. */
const rowsByLayer = new Map<string, TownRow[]>()

/** The match in progress; closing the dialog cancels it. */
let running: AbortController | undefined

export function openMatchTowns(id: string): void {
  setLayerId(id)
}

/**
 * Asks for up to four towns printed on the image and places the image by them. A row's
 * place can be picked on the map by hand (for a name the automatic lookup cannot find,
 * such as a pass, or to settle which of several places is meant). The dialog stays open
 * with an explanation when fewer than two towns could be matched; Cancel or Esc also
 * stops a match in progress.
 */
export function MatchTownsDialog() {
  let dialog!: HTMLDialogElement
  createEffect(() => {
    const open = layerId() !== undefined
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  })
  const close = () => {
    running?.abort()
    running = undefined
    setLayerId(undefined)
  }
  return (
    <dialog ref={dialog} class="dialog" aria-label="Match towns" onClose={close}>
      <Show when={layerId()} keyed>
        {(id) => <TownForm layerId={id} onClose={close} />}
      </Show>
    </dialog>
  )
}

function TownForm(props: { layerId: string; onClose: () => void }) {
  const map = useMapAccessor()
  const [rows, setRows] = createStore<TownRow[]>(
    structuredClone(rowsByLayer.get(props.layerId) ?? Array.from({ length: ROWS }, () => ({ label: '' }))),
  )
  onCleanup(() => rowsByLayer.set(props.layerId, structuredClone(unwrap(rows))))
  const [progress, setProgress] = createSignal<MatchProgress>()
  const [message, setMessage] = createSignal<string>()
  /** The row whose place is being searched for. */
  const [searching, setSearching] = createSignal<number>()
  const busy = () => progress() !== undefined

  const submit = async () => {
    const m = map()
    if (!m || running) return
    const towns: TownInput[] = []
    for (const row of rows) {
      const name = row.label.trim()
      if (name && !towns.some((t) => t.name === name)) towns.push({ name, at: row.place?.center })
    }
    if (towns.length < 2) {
      setMessage('Name at least two towns.')
      return
    }
    setSearching(undefined)
    setMessage(undefined)
    const controller = new AbortController()
    running = controller
    try {
      const solution = await matchTowns(m, props.layerId, towns, setProgress, controller.signal)
      if (solution.fit) props.onClose()
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
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <h2>Match towns</h2>
      <p class="muted hint">
        Name towns printed on the image, spelled as printed and as far apart as possible. They are looked for on
        the image and the map; the image is placed by them and each becomes a point pair. The pin picks a place on
        the map by hand: a pass or a peak, or the right one of several places with that name.
      </p>
      <ol class="town-rows">
        <For each={rows}>
          {(row, i) => (
            <li>
              <div class="row">
                <input
                  class="grow"
                  aria-label={`Town ${i() + 1}`}
                  placeholder={`Town ${i() + 1}`}
                  autocomplete="off"
                  value={row.label}
                  disabled={busy()}
                  onInput={(e) => setRows(i(), 'label', e.currentTarget.value)}
                />
                <button
                  type="button"
                  class="icon"
                  title="Pick this place on the map"
                  aria-label={`Pick ${row.label.trim() || `town ${i() + 1}`} on the map`}
                  aria-expanded={searching() === i()}
                  disabled={busy()}
                  onClick={() => setSearching((s) => (s === i() ? undefined : i()))}
                >
                  <FindPlaceIcon />
                </button>
              </div>
              <Show when={searching() === i()}>
                <PlaceSearch
                  term={row.label}
                  onPick={(place) => {
                    setRows(i(), 'place', place)
                    setSearching(undefined)
                  }}
                  onClose={() => setSearching(undefined)}
                />
              </Show>
              <Show when={row.place}>
                {(place) => (
                  <div class="row picked-place">
                    <span class="grow" title={place().label}>
                      {place().label}
                    </span>
                    <button
                      type="button"
                      class="icon"
                      title="Look the town up automatically again"
                      aria-label={`Forget the picked place of ${row.label.trim() || `town ${i() + 1}`}`}
                      disabled={busy()}
                      onClick={() => setRows(i(), 'place', undefined)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </Show>
            </li>
          )}
        </For>
      </ol>
      <Show when={status()}>{(text) => <p role="status">{text()}</p>}</Show>
      <Show when={message()}>{(text) => <p class="note warning">{text()}</p>}</Show>
      <div class="row end">
        <button type="button" onClick={() => props.onClose()}>
          Cancel
        </button>
        <button type="submit" class="primary" disabled={busy()}>
          Match
        </button>
      </div>
    </form>
  )
}

/**
 * A place search under a row, started right away with the row's name; the search can be
 * changed until the right place comes up. Unlike the automatic lookup it finds any kind
 * of place. Esc closes it without closing the dialog.
 */
function PlaceSearch(props: { term: string; onPick: (place: Place) => void; onClose: () => void }) {
  const map = useMapAccessor()
  const [term, setTerm] = createSignal(props.term.trim())
  const [results, setResults] = createSignal<Place[]>()
  const [searchingNow, setSearchingNow] = createSignal(false)
  const [error, setError] = createSignal<string>()
  let input!: HTMLInputElement

  const search = async () => {
    const q = term().trim()
    const m = map()
    if (!q || searchingNow()) return
    setSearchingNow(true)
    setError(undefined)
    try {
      setResults(await searchPlaces(q, { viewbox: m && searchViewbox(m) }))
    } catch (err) {
      setResults(undefined)
      setError(errorMessage(err))
    } finally {
      setSearchingNow(false)
    }
  }
  onMount(() => {
    input.focus()
    void search()
  })

  return (
    <div class="place-search">
      <div class="row">
        <input
          ref={input}
          class="grow"
          type="search"
          aria-label="Search the map"
          placeholder="Search the map"
          value={term()}
          onInput={(e) => setTerm(e.currentTarget.value)}
          onKeyDown={(e) => {
            // Enter searches here instead of submitting the dialog; Esc closes only this search.
            if (e.key === 'Enter') {
              e.preventDefault()
              void search()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              props.onClose()
            }
          }}
        />
        <button type="button" disabled={searchingNow()} onClick={() => void search()}>
          Search
        </button>
      </div>
      <Show when={searchingNow()}>
        <p class="muted hint">Searching…</p>
      </Show>
      <Show when={error()}>{(text) => <p class="note error">{text()}</p>}</Show>
      <Show when={!searchingNow() && results()}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={<p class="muted hint">Nothing found. Change the search and try again.</p>}
          >
            <ul class="search-results">
              <For each={list()}>
                {(place) => (
                  <li>
                    <button type="button" class="result" onClick={() => props.onPick(place)}>
                      <strong>{place.name}</strong>
                      <span class="muted">{place.label}</span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
            <p class="muted credit">Search by Nominatim · © OpenStreetMap contributors</p>
          </Show>
        )}
      </Show>
    </div>
  )
}
