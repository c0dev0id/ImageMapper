import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { createStore, unwrap } from 'solid-js/store'
import type { LngLat, Px } from '../geo/types.ts'
import { useMapAccessor } from '../map/context.ts'
import { searchViewbox } from '../map/navigate.ts'
import { searchPlaces, type Place } from '../search/nominatim.ts'
import { warpOf } from '../state/derived.ts'
import { imageBlob } from '../state/images.ts'
import { layerById } from '../state/project.ts'
import { cancelTapRequest, errorMessage, requestTap, tapRequest, type TapRequest } from '../state/ui.ts'
import { PinImageIcon, PinMapIcon } from '../ui/icons.tsx'
import { matchTowns, type MatchProgress, type TownInput } from './matchTowns.ts'
import { labelAt } from './names.ts'
import { readWords } from './ocr.ts'
import { describeSolution } from './report.ts'
import type { TownMiss } from './solve.ts'

/** A name as printed on the image, with where it is printed and its place on the map if the user picked them. */
interface TownRow {
  label: string
  image?: Px
  place?: Place
}

const ROWS = 4

/** The layer the dialog works on while it is open. */
const [layerId, setLayerId] = createSignal<string>()

/** Rows per layer in this session, so that a second try starts from the first. */
const rowsByLayer = new Map<string, TownRow[]>()

/** Work in progress (matching, or reading the image for a pick); closing the dialog cancels it. */
let running: AbortController | undefined

/** This dialog's request for a tap on the image, so that closing the dialog can withdraw it. */
let ownTap: TapRequest | undefined

/** Where the dialog was dragged to, for the next time it opens. */
let position: { left: number; top: number } | undefined

export function openMatchTowns(id: string): void {
  setLayerId(id)
}

/**
 * Asks for up to four towns printed on the image and places the image by them. Each row
 * can be pinned by hand on the image (tap the printed name; an empty row takes the name
 * read there) and on the map (a search). The dialog does not block the map, so the image
 * can be panned, zoomed and tapped, and it can be dragged aside by its title. It stays
 * open until every town is matched, asking for the ones that were not; Close or Esc also
 * stops work in progress.
 */
export function MatchTownsDialog() {
  const map = useMapAccessor()
  let dialog!: HTMLDialogElement

  const close = () => {
    running?.abort()
    running = undefined
    if (ownTap && tapRequest() === ownTap) cancelTapRequest()
    setLayerId(undefined)
  }
  createEffect(() => {
    const open = layerId() !== undefined
    if (open && !dialog.open) {
      dialog.show()
      placeDialog(dialog, map()?.getContainer().getBoundingClientRect())
    } else if (!open && dialog.open) dialog.close()
  })
  // The dialog belongs to its layer: deleting the layer closes it.
  createEffect(() => {
    const id = layerId()
    if (id && !layerById(id)) close()
  })

  return (
    <dialog
      ref={dialog}
      class="dialog floating"
      aria-label="Match towns"
      onClose={close}
      onKeyDown={(e) => {
        // Esc withdraws a tap request first; a search handles its own Esc. The map's keys
        // leave alone what is handled here.
        if (e.key !== 'Escape' || e.defaultPrevented) return
        e.preventDefault()
        if (tapRequest()) cancelTapRequest()
        else close()
      }}
    >
      <Show when={layerId()} keyed>
        {(id) => <TownForm layerId={id} dialog={dialog} onClose={close} />}
      </Show>
    </dialog>
  )
}

function TownForm(props: { layerId: string; dialog: HTMLDialogElement; onClose: () => void }) {
  const map = useMapAccessor()
  const [rows, setRows] = createStore<TownRow[]>(
    structuredClone(rowsByLayer.get(props.layerId) ?? Array.from({ length: ROWS }, () => ({ label: '' }))),
  )
  onCleanup(() => rowsByLayer.set(props.layerId, structuredClone(unwrap(rows))))
  const [progress, setProgress] = createSignal<MatchProgress>()
  const [message, setMessage] = createSignal<{ kind: 'info' | 'warning'; text: string }>()
  /** Why towns were left out by the last match, by name. */
  const [misses, setMisses] = createSignal(new Map<string, TownMiss['reason']>())
  /** The row whose place is being searched for on the map. */
  const [searching, setSearching] = createSignal<number>()
  /** The row waiting for a tap on the image. */
  const [picking, setPicking] = createSignal<number>()
  const busy = () => progress() !== undefined
  let firstInput!: HTMLInputElement
  onMount(() => firstInput.focus())

  const missOf = (row: TownRow) => misses().get(row.label.trim())
  const forgetMiss = (row: TownRow) => {
    const next = new Map(misses())
    next.delete(row.label.trim())
    setMisses(next)
  }

  const pickOnImage = (i: number) => {
    const layer = layerById(props.layerId)
    if (!layer || busy()) return
    if (picking() === i) {
      cancelTapRequest()
      return
    }
    if (!layer.visible) {
      setMessage({ kind: 'warning', text: 'Show the image to pick a name on it.' })
      return
    }
    setSearching(undefined)
    const name = rows[i].label.trim()
    ownTap = {
      hint: name ? `Tap where “${name}” is printed on the image.` : `Tap a name printed on the image.`,
      onTap: (lngLat) => {
        setPicking(undefined)
        void readAt(i, lngLat)
      },
      onCancel: () => setPicking(undefined),
    }
    requestTap(ownTap)
    setPicking(i)
  }

  /** Takes the tapped spot for the row; an empty row also takes the name read there. */
  const readAt = async (i: number, lngLat: LngLat) => {
    const layer = layerById(props.layerId)
    const at = layer && warpOf(layer.id)?.mapToImage(lngLat)
    if (!layer || !at) {
      setMessage({ kind: 'warning', text: 'That was beside the image: tap where the name is printed on it.' })
      pickOnImage(i)
      return
    }
    setMessage(undefined)
    let label: { text: string; at: Px } | undefined
    const image = imageBlob(layer.id, layer.mime)
    const controller = new AbortController()
    running = controller
    try {
      if (image) {
        const words = await readWords(
          layer.id,
          image,
          (stage, share) => setProgress({ reading: { stage, share }, lookedUp: 0, total: 0 }),
          controller.signal,
        )
        label = labelAt(words, at)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage({ kind: 'warning', text: errorMessage(error) })
    } finally {
      if (running === controller) running = undefined
      setProgress(undefined)
    }
    forgetMiss(rows[i])
    const name = rows[i].label.trim() || label?.text || ''
    setRows(i, { label: name, image: label?.at ?? at })
    if (!name) setMessage({ kind: 'warning', text: 'No name was read there: type it as it is printed.' })
  }

  const submit = async () => {
    const m = map()
    if (!m || running) return
    if (tapRequest() === ownTap) cancelTapRequest()
    const towns: TownInput[] = []
    for (const row of rows) {
      const name = row.label.trim()
      if (name && !towns.some((t) => t.name === name)) {
        towns.push({ name, image: row.image && [row.image[0], row.image[1]], at: row.place?.center })
      }
    }
    if (towns.length < 2) {
      setMessage({ kind: 'warning', text: 'Name at least two towns.' })
      return
    }
    setSearching(undefined)
    setMessage(undefined)
    const controller = new AbortController()
    running = controller
    try {
      const solution = await matchTowns(m, props.layerId, towns, setProgress, controller.signal)
      setMisses(new Map(solution.misses.map((miss) => [miss.name, miss.reason])))
      if (solution.fit && solution.misses.length === 0) props.onClose()
      else setMessage({ kind: solution.fit ? 'info' : 'warning', text: describeSolution(solution) })
    } catch (error) {
      if (!controller.signal.aborted) setMessage({ kind: 'warning', text: errorMessage(error) })
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
      <h2 class="dialog-handle" title="Drag to move" onPointerDown={(e) => dragDialog(e, props.dialog)}>
        Match towns
      </h2>
      <p class="muted hint">
        Name towns printed on the image, spelled as printed and far apart. They are looked for on the image and the
        map, and the image is placed by them. Where that fails, pick a town by hand: on the image (an empty row takes
        the name read there) or on the map.
      </p>
      <ol class="town-rows">
        <For each={rows}>
          {(row, i) => {
            const name = () => row.label.trim() || `town ${i() + 1}`
            return (
              <li>
                <div class="row">
                  <input
                    ref={(el) => {
                      if (i() === 0) firstInput = el
                    }}
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
                    classList={{ active: picking() === i() }}
                    title="Pick where the name is printed on the image"
                    aria-label={`Pick ${name()} on the image`}
                    aria-pressed={picking() === i()}
                    disabled={busy()}
                    onClick={() => pickOnImage(i())}
                  >
                    <PinImageIcon />
                  </button>
                  <button
                    type="button"
                    class="icon"
                    title="Pick the place on the map"
                    aria-label={`Pick ${name()} on the map`}
                    aria-expanded={searching() === i()}
                    disabled={busy()}
                    onClick={() => setSearching((s) => (s === i() ? undefined : i()))}
                  >
                    <PinMapIcon />
                  </button>
                </div>
                <Show when={searching() === i()}>
                  <PlaceSearch
                    term={row.label}
                    onPick={(place) => {
                      forgetMiss(row)
                      setRows(i(), 'place', place)
                      setSearching(undefined)
                    }}
                    onClose={() => setSearching(undefined)}
                  />
                </Show>
                <Show when={row.image}>
                  <div class="row picked">
                    <span class="grow">Picked on the image</span>
                    <button
                      type="button"
                      class="icon"
                      title="Look for the name on the image again"
                      aria-label={`Forget where ${name()} is on the image`}
                      disabled={busy()}
                      onClick={() => setRows(i(), 'image', undefined)}
                    >
                      ×
                    </button>
                  </div>
                </Show>
                <Show when={row.place}>
                  {(place) => (
                    <div class="row picked">
                      <span class="grow" title={place().label}>
                        {place().label}
                      </span>
                      <button
                        type="button"
                        class="icon"
                        title="Look the town up automatically again"
                        aria-label={`Forget the picked place of ${name()}`}
                        disabled={busy()}
                        onClick={() => setRows(i(), 'place', undefined)}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </Show>
                <Show when={missOf(row)}>
                  {(reason) => (
                    <p class="row-note">
                      <Show when={reason() === 'image'}>
                        Not read on the image.{' '}
                        <button type="button" class="link" onClick={() => pickOnImage(i())}>
                          Tap it on the image
                        </button>
                      </Show>
                      <Show when={reason() === 'map'}>
                        Not found on the map.{' '}
                        <button type="button" class="link" onClick={() => setSearching(i())}>
                          Search the map
                        </button>
                      </Show>
                      <Show when={reason() === 'fit'}>
                        Does not fit the others: check the name, or pick it on the image or the map.
                      </Show>
                    </p>
                  )}
                </Show>
              </li>
            )
          }}
        </For>
      </ol>
      <Show when={status()}>{(text) => <p role="status">{text()}</p>}</Show>
      <Show when={message()}>{(m) => <p class={`note ${m().kind}`}>{m().text}</p>}</Show>
      <div class="row end">
        <button type="button" onClick={() => props.onClose()}>
          Close
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

/** Moves the dialog, keeping enough of its title on screen to drag it back. */
function moveDialog(dialog: HTMLDialogElement, left: number, top: number): void {
  const width = dialog.offsetWidth
  position = {
    left: Math.min(Math.max(left, 80 - width), window.innerWidth - 80),
    top: Math.min(Math.max(top, 0), window.innerHeight - 40),
  }
  dialog.style.left = `${position.left}px`
  dialog.style.top = `${position.top}px`
}

/** Where the dialog opens: where it was left, else beside the map's buttons (on phones, at the top). */
function placeDialog(dialog: HTMLDialogElement, map: DOMRect | undefined): void {
  if (position) {
    moveDialog(dialog, position.left, position.top)
    return
  }
  const area = map ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
  const wide = area.width > 720
  moveDialog(
    dialog,
    wide ? area.right - dialog.offsetWidth - 60 : area.left + (area.width - dialog.offsetWidth) / 2,
    area.top + (wide ? 60 : 8),
  )
}

/** Drags the dialog by its title, with mouse, touch or pen. */
function dragDialog(e: PointerEvent, dialog: HTMLDialogElement): void {
  if (!e.isPrimary || e.button !== 0) return
  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)
  const start = dialog.getBoundingClientRect()
  const move = (ev: PointerEvent) => moveDialog(dialog, start.left + ev.clientX - e.clientX, start.top + ev.clientY - e.clientY)
  const end = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', end)
    handle.removeEventListener('pointercancel', end)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}
