import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { createStore, unwrap } from 'solid-js/store'
import type { Px } from '../geo/types.ts'
import { useMap } from '../map/context.ts'
import { searchViewbox } from '../map/navigate.ts'
import { searchPlaces, type Place } from '../search/nominatim.ts'
import { warpOf } from '../state/derived.ts'
import { layerById } from '../state/project.ts'
import { cancelTapRequest, errorMessage, requestTap, tapRequest } from '../state/ui.ts'
import { PinImageIcon } from '../ui/icons.tsx'
import { PlaceResults } from '../ui/PlaceResults.tsx'
import { matchTowns } from './matchTowns.ts'
import './MatchTowns.css'
import { describeMatch, type MatchNote } from './report.ts'
import type { TownPair } from './solve.ts'

/**
 * A town as the user picks it: the search for it, the place picked from the results, its
 * spot on the image, and why the last match could not use it.
 */
interface TownRow {
  term: string
  place?: Place
  image?: Px
  miss?: 'place' | 'image' | 'fit'
}

const ROWS = 4

const SHOW_IMAGE = 'Show the image to pick a spot on it.'

/** The layer the dialog works on while it is open. */
const [layerId, setLayerId] = createSignal<string>()

/** Rows per layer in this session, so that a second try starts from the first. */
const rowsByLayer = new Map<string, TownRow[]>()

export function openMatchTowns(id: string): void {
  setLayerId(id)
}

/**
 * Asks for up to four towns and places the image by them: each is searched for and picked
 * from the results, and its spot is tapped on the image. The dialog does not block the
 * map, so the image can be panned, zoomed and tapped, and it can be dragged aside by its
 * title. It stays open until every town it was given is used, saying per row what is
 * missing; Close or Esc closes it.
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
        // Esc withdraws a pending pick first, then closes; a row with search results open
        // closes those first. The map's key handling leaves alone what is handled here.
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
  // Searches prefer what was in view when the dialog opened, so searching again for a
  // name after the view moved asks the same question, which the search has cached.
  const viewbox = searchViewbox(map)
  const [rows, setRows] = createStore<TownRow[]>(
    structuredClone(rowsByLayer.get(props.layerId) ?? Array.from({ length: ROWS }, () => ({ term: '' }))),
  )
  const [message, setMessage] = createSignal<MatchNote>()
  /** The row waiting for a tap on the image. */
  const [picking, setPicking] = createSignal<number>()
  /** The row whose search is running. */
  const [searching, setSearching] = createSignal<number>()
  /** The row whose search results are shown, with the places found or why the search failed. */
  const [found, setFound] = createSignal<{ row: number; places?: Place[]; error?: string }>()
  let firstInput!: HTMLInputElement
  onMount(() => firstInput.focus())
  // The form goes when the dialog closes or turns to another layer; its pick goes with
  // it, and its rows are kept for the next time.
  onCleanup(() => {
    if (picking() !== undefined) cancelTapRequest()
    rowsByLayer.set(props.layerId, unwrap(rows))
  })

  const nameOf = (i: number) => rows[i].place?.name ?? (rows[i].term.trim() || `town ${i + 1}`)

  const search = async (i: number) => {
    const q = rows[i].term.trim()
    if (!q || searching() !== undefined) return
    setSearching(i)
    setFound(undefined)
    try {
      setFound({ row: i, places: await searchPlaces(q, { viewbox }) })
    } catch (error) {
      setFound({ row: i, error: errorMessage(error) })
    } finally {
      setSearching(undefined)
    }
  }

  const pickOnImage = (i: number) => {
    if (picking() === i) {
      cancelTapRequest()
      return
    }
    if (!layerById(props.layerId)?.visible) {
      setMessage({ kind: 'warning', text: SHOW_IMAGE })
      return
    }
    requestTap({
      hint: `Tap where ${nameOf(i)} is on the image.`,
      onTap: (lngLat) => {
        const layer = layerById(props.layerId)
        const at = layer?.visible ? warpOf(layer.id)?.mapToImage(lngLat) : undefined
        if (!at) {
          const text = layer?.visible ? `That was beside the image: tap where ${nameOf(i)} is on it.` : SHOW_IMAGE
          setMessage({ kind: 'warning', text })
          return false
        }
        setPicking(undefined)
        setMessage(undefined)
        setRows(i, { image: at, miss: undefined })
      },
      onCancel: () => setPicking(undefined),
    })
    setPicking(i)
  }

  const submit = () => {
    if (picking() !== undefined) cancelTapRequest()
    setFound(undefined)
    // Rows the user started; those with a place and a spot are matched, by their position here.
    const used = unwrap(rows).flatMap((row, index) => (row.term.trim() || row.place || row.image ? [{ row, index }] : []))
    const complete = used.flatMap(({ row, index }) =>
      row.place && row.image ? [{ index, town: { name: row.place.name, image: row.image, map: row.place.center } }] : [],
    )
    for (const { row, index } of used) setRows(index, 'miss', !row.place ? 'place' : !row.image ? 'image' : undefined)
    if (complete.length < 2) {
      setMessage({ kind: 'warning', text: 'Pick at least two towns, each with its place and its spot on the image.' })
      return
    }
    const towns: TownPair[] = complete.map((c) => c.town)
    const { fit, misfits } = matchTowns(map, props.layerId, towns)
    if (!fit) {
      setMessage({
        kind: 'warning',
        text: 'The image could not be placed: pick spots farther apart on the image, and check the places.',
      })
      return
    }
    for (const town of misfits) setRows(complete[town].index, 'miss', 'fit')
    if (complete.length === used.length && misfits.length === 0) props.onClose()
    else setMessage(describeMatch(towns, misfits))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <p class="muted hint">
        For each town, search for it and pick it from the results, then tap its spot on the image with the image pin.
        Towns far apart work best. The image is placed by them, and each becomes a point pair.
      </p>
      <ol class="town-rows">
        <For each={rows}>
          {(row, i) => (
            <li>
              <div class="row">
                <input
                  ref={(el) => {
                    if (i() === 0) firstInput = el
                  }}
                  class="grow"
                  type="search"
                  aria-label={`Town ${i() + 1}`}
                  placeholder={`Town ${i() + 1}`}
                  autocomplete="off"
                  value={row.term}
                  onInput={(e) => setRows(i(), { term: e.currentTarget.value, miss: undefined })}
                  onKeyDown={(e) => {
                    // Enter searches instead of matching; Esc closes this row's results first.
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void search(i())
                    } else if (e.key === 'Escape' && found()?.row === i()) {
                      e.preventDefault()
                      setFound(undefined)
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={searching() !== undefined}
                  aria-label={`Search for town ${i() + 1}`}
                  onClick={() => void search(i())}
                >
                  Search
                </button>
                <button
                  type="button"
                  class="icon"
                  classList={{ active: picking() === i() }}
                  title="Tap its spot on the image"
                  aria-label={`Pick ${nameOf(i())} on the image`}
                  aria-pressed={picking() === i()}
                  onClick={() => pickOnImage(i())}
                >
                  <PinImageIcon />
                </button>
              </div>
              <Show when={searching() === i()}>
                <p class="muted hint">Searching…</p>
              </Show>
              <Show when={found()?.row === i() && found()}>
                {(result) => (
                  <div class="town-results">
                    <Show when={result().error}>{(text) => <p class="note error">{text()}</p>}</Show>
                    <Show when={result().places}>
                      {(places) => (
                        <PlaceResults
                          places={places()}
                          empty="Nothing found. Change the search and try again."
                          onPick={(place) => {
                            setRows(i(), { place, miss: undefined })
                            setFound(undefined)
                          }}
                        />
                      )}
                    </Show>
                  </div>
                )}
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
                      title="Forget this place"
                      aria-label={`Forget the place of ${nameOf(i())}`}
                      onClick={() => setRows(i(), 'place', undefined)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </Show>
              <Show when={row.image}>
                <div class="row picked">
                  <span class="grow">Spot picked on the image</span>
                  <button
                    type="button"
                    class="icon"
                    title="Forget this spot"
                    aria-label={`Forget the spot of ${nameOf(i())}`}
                    onClick={() => setRows(i(), 'image', undefined)}
                  >
                    ×
                  </button>
                </div>
              </Show>
              <Show when={row.miss}>
                {(reason) => (
                  <p class="row-note">
                    <Show when={reason() === 'place'}>Search for it and pick the place from the results.</Show>
                    <Show when={reason() === 'image'}>
                      No spot on the image yet.{' '}
                      <button type="button" class="link" onClick={() => pickOnImage(i())}>
                        Tap it on the image
                      </button>
                    </Show>
                    <Show when={reason() === 'fit'}>Does not fit the others: check the place and the spot.</Show>
                  </p>
                )}
              </Show>
            </li>
          )}
        </For>
      </ol>
      <Show when={message()}>{(m) => <p class={`note ${m().kind}`}>{m().text}</p>}</Show>
      <div class="row end">
        <button type="button" onClick={() => props.onClose()}>
          Close
        </button>
        <button type="submit" class="primary">
          Match
        </button>
      </div>
    </form>
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
