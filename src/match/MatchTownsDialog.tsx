import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { createStore, unwrap } from 'solid-js/store'
import type { Px } from '../geo/types.ts'
import { useMap } from '../map/context.ts'
import { searchViewbox } from '../map/navigate.ts'
import { searchPlaces, type Place, type Viewbox } from '../search/nominatim.ts'
import { warpOf } from '../state/derived.ts'
import { imageBlob } from '../state/images.ts'
import { layerById } from '../state/project.ts'
import { cancelTapRequest, errorMessage, requestTap, tapRequest } from '../state/ui.ts'
import { PinImageIcon, PinMapIcon } from '../ui/icons.tsx'
import { PlaceResults } from '../ui/PlaceResults.tsx'
import { matchTowns, type MatchProgress, type TownInput } from './matchTowns.ts'
import './MatchTowns.css'
import { labelAt } from './names.ts'
import { knownWords, readWords } from './ocr.ts'
import { describeSolution, type MatchNote } from './report.ts'
import type { TownMiss } from './solve.ts'

/**
 * A town as the user gave it: the name as printed on the image, where it is printed and
 * its place on the map if picked by hand, and why the last match left it out.
 */
interface TownRow {
  label: string
  image?: Px
  place?: Place
  miss?: TownMiss['reason']
}

const ROWS = 4

const SHOW_IMAGE = 'Show the image to pick a name on it.'

/** The layer the dialog works on while it is open. */
const [layerId, setLayerId] = createSignal<string>()

/** Rows per layer in this session, so that a second try starts from the first. */
const rowsByLayer = new Map<string, TownRow[]>()

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
  const map = useMap()
  let dialog!: HTMLDialogElement
  const close = () => setLayerId(undefined)

  createEffect(() => {
    const open = layerId() !== undefined
    if (open && !dialog.open) {
      dialog.show()
      placeDialog(dialog, map.getContainer().getBoundingClientRect())
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
        // Esc withdraws a pending pick first, then closes; a search under a row handles its
        // own Esc. The map's key handling leaves alone what is handled here.
        if (e.key !== 'Escape' || e.defaultPrevented) return
        e.preventDefault()
        if (tapRequest()) cancelTapRequest()
        else close()
      }}
    >
      <h2 class="dialog-handle" title="Drag to move" onPointerDown={(e) => dragDialog(e, dialog)}>
        Match towns
      </h2>
      <Show when={layerId()} keyed>
        {(id) => <TownForm layerId={id} onClose={close} />}
      </Show>
    </dialog>
  )
}

function TownForm(props: { layerId: string; onClose: () => void }) {
  const map = useMap()
  // Towns are looked up near what was in view when the dialog opened, so a retry after the
  // view has moved asks the same questions, which the search answers from its cache.
  const viewbox = searchViewbox(map)
  const [rows, setRows] = createStore<TownRow[]>(
    structuredClone(rowsByLayer.get(props.layerId) ?? Array.from({ length: ROWS }, () => ({ label: '' }))),
  )
  const [progress, setProgress] = createSignal<MatchProgress>()
  const [message, setMessage] = createSignal<MatchNote>()
  /** The row whose place is being searched for on the map. */
  const [searching, setSearching] = createSignal<number>()
  /** The row waiting for a tap on the image. */
  const [picking, setPicking] = createSignal<number>()
  /** Work in progress: matching, or reading the image for a pick. */
  let running: AbortController | undefined
  const busy = () => progress() !== undefined
  let firstInput!: HTMLInputElement
  onMount(() => firstInput.focus())
  // The form goes when the dialog closes or turns to another layer; its work and its pick
  // go with it, and its rows are kept for the next time.
  onCleanup(() => {
    running?.abort()
    if (picking() !== undefined) cancelTapRequest()
    rowsByLayer.set(props.layerId, unwrap(rows))
  })

  const pickOnImage = (i: number) => {
    if (busy()) return
    if (picking() === i) {
      cancelTapRequest()
      return
    }
    if (!layerById(props.layerId)?.visible) {
      setMessage({ kind: 'warning', text: SHOW_IMAGE })
      return
    }
    setSearching(undefined)
    const name = rows[i].label.trim()
    requestTap({
      hint: name ? `Tap where “${name}” is printed on the image.` : 'Tap a name printed on the image.',
      onTap: (lngLat) => {
        const layer = layerById(props.layerId)
        const at = layer?.visible ? warpOf(layer.id)?.mapToImage(lngLat) : undefined
        if (!at) {
          const text = layer?.visible ? 'That was beside the image: tap where the name is printed on it.' : SHOW_IMAGE
          setMessage({ kind: 'warning', text })
          return false
        }
        setPicking(undefined)
        void readAt(i, at)
      },
      onCancel: () => setPicking(undefined),
    })
    setPicking(i)
  }

  /**
   * Takes the tapped spot for the row, centred on the name printed there when the image's
   * words are known. An empty row also takes that name, so its image is read if need be.
   */
  const readAt = async (i: number, at: Px) => {
    setMessage(undefined)
    let words = knownWords(props.layerId)
    if (!words && !rows[i].label.trim()) {
      const layer = layerById(props.layerId)
      const image = layer && imageBlob(layer.id, layer.mime)
      const controller = new AbortController()
      running = controller
      try {
        if (image) {
          words = await readWords(
            props.layerId,
            image,
            (stage, share) => setProgress({ reading: { stage, share }, lookedUp: 0, total: 0 }),
            controller.signal,
          )
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setMessage({ kind: 'warning', text: errorMessage(error) })
      } finally {
        running = undefined
        setProgress(undefined)
      }
    }
    const label = words && labelAt(words, at)
    const name = rows[i].label.trim() || label?.text || ''
    setRows(i, { label: name, image: label?.at ?? at, miss: undefined })
    if (!name) setMessage({ kind: 'warning', text: 'No name was read there: type it as it is printed.' })
  }

  const submit = async () => {
    if (running) return
    if (picking() !== undefined) cancelTapRequest()
    // The rows with a name; the match refers to them by their position in this list.
    const named = unwrap(rows).flatMap((row, index) => (row.label.trim() ? [{ row, index }] : []))
    if (named.length < 2) {
      setMessage({ kind: 'warning', text: 'Name at least two towns.' })
      return
    }
    setSearching(undefined)
    setMessage(undefined)
    const towns: TownInput[] = named.map(({ row }) => ({ name: row.label.trim(), image: row.image, at: row.place?.center }))
    const controller = new AbortController()
    running = controller
    try {
      const solution = await matchTowns(map, props.layerId, towns, {
        viewbox,
        onProgress: setProgress,
        signal: controller.signal,
      })
      named.forEach(({ index }, town) => setRows(index, 'miss', solution.misses.find((m) => m.index === town)?.reason))
      if (solution.fit && solution.misses.length === 0) props.onClose()
      else setMessage(describeSolution(solution))
    } catch (error) {
      if (!controller.signal.aborted) setMessage({ kind: 'warning', text: errorMessage(error) })
    } finally {
      running = undefined
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
                    onInput={(e) => setRows(i(), { label: e.currentTarget.value, miss: undefined })}
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
                    viewbox={viewbox}
                    onPick={(place) => {
                      setRows(i(), { place, miss: undefined })
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
                      <span class="grow name" title={place().label}>
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
                <Show when={row.miss}>
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
      <Show when={status()}>
        {(text) => (
          <p class="muted hint" role="status">
            {text()}
          </p>
        )}
      </Show>
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
function PlaceSearch(props: {
  term: string
  viewbox: Viewbox | undefined
  onPick: (place: Place) => void
  onClose: () => void
}) {
  const [term, setTerm] = createSignal(props.term.trim())
  const [results, setResults] = createSignal<Place[]>()
  const [searching, setSearching] = createSignal(false)
  const [error, setError] = createSignal<string>()
  let input!: HTMLInputElement

  const search = async () => {
    const q = term().trim()
    if (!q || searching()) return
    setSearching(true)
    setError(undefined)
    try {
      setResults(await searchPlaces(q, { viewbox: props.viewbox }))
    } catch (err) {
      setResults(undefined)
      setError(errorMessage(err))
    } finally {
      setSearching(false)
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
        <button type="button" disabled={searching()} onClick={() => void search()}>
          Search
        </button>
      </div>
      <Show when={searching()}>
        <p class="muted hint">Searching…</p>
      </Show>
      <Show when={error()}>{(text) => <p class="note error">{text()}</p>}</Show>
      <Show when={!searching() && results()}>
        {(list) => (
          <PlaceResults places={list()} empty="Nothing found. Change the search and try again." onPick={props.onPick} />
        )}
      </Show>
    </div>
  )
}

/** Moves the dialog, keeping enough of its title on screen to drag it back. */
function moveDialog(dialog: HTMLDialogElement, left: number, top: number): void {
  dialog.style.left = `${Math.min(Math.max(left, 80 - dialog.offsetWidth), window.innerWidth - 80)}px`
  dialog.style.top = `${Math.min(Math.max(top, 0), window.innerHeight - 40)}px`
}

/** Where the dialog opens: where it was left, else beside the map's buttons (on phones, at the top). */
function placeDialog(dialog: HTMLDialogElement, map: DOMRect): void {
  if (dialog.style.left) {
    const { left, top } = dialog.getBoundingClientRect()
    moveDialog(dialog, left, top)
    return
  }
  const wide = map.width > 720
  moveDialog(
    dialog,
    wide ? map.right - dialog.offsetWidth - 60 : map.left + (map.width - dialog.offsetWidth) / 2,
    map.top + (wide ? 60 : 8),
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
