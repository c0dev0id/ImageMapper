import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { createStore, produce, unwrap } from 'solid-js/store'
import { useMap } from '../map/context.ts'
import { newPointWarp } from '../map/gcpMenu.ts'
import { searchViewbox } from '../map/navigate.ts'
import { searchPlaces, type Place } from '../search/nominatim.ts'
import { layerById } from '../state/project.ts'
import { cancelTapRequest, errorMessage, requestTap, tapRequest, type TapRequest } from '../state/ui.ts'
import { GripIcon, PinImageIcon } from '../ui/icons.tsx'
import { PlaceResults } from '../ui/PlaceResults.tsx'
import { matchTowns } from './matchTowns.ts'
import './MatchTowns.css'
import type { MatchNote } from './report.ts'
import { completeTowns, rowNote, type TownRow } from './towns.ts'

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
 * title bar. It stays open until every town it was given is used, saying per row what is
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
      <div class="dialog-bar" title="Drag to move" onPointerDown={(e) => dragDialog(e, dialog)}>
        <GripIcon />
        <h2>Match towns</h2>
      </div>
      <Show when={layerId()} keyed>
        {(id) => <TownForm layerId={id} onClose={close} />}
      </Show>
    </dialog>
  )
}

function TownForm(props: { layerId: string; onClose: () => void }) {
  const map = useMap()
  const [rows, setRows] = createStore<TownRow[]>(
    structuredClone(rowsByLayer.get(props.layerId) ?? Array.from({ length: ROWS }, () => ({ term: '' }))),
  )
  const [message, setMessage] = createSignal<MatchNote>()
  /** Whether Match was pressed: from then on, rows say what they still need. */
  const [tried, setTried] = createSignal(false)
  /** The row whose search is running. */
  const [searching, setSearching] = createSignal<number>()
  /** The row whose search results are shown, with the places found or why the search failed. */
  const [found, setFound] = createSignal<{ row: number; places?: Place[]; error?: string }>()
  /** This form's last tap request; the row it is for waits for a tap while it is open. */
  let pick: { row: number; request: TapRequest } | undefined
  const picking = () => {
    // Read first, so that whoever asks always tracks the request, even before the first pick.
    const open = tapRequest()
    return open && open === pick?.request ? pick.row : undefined
  }
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
      setFound({ row: i, places: await searchPlaces(q, { viewbox: searchViewbox(map) }) })
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
    const request: TapRequest = {
      hint: `Tap where ${nameOf(i)} is on the image.`,
      onTap: (lngLat) => {
        const layer = layerById(props.layerId)
        const at = newPointWarp(layer)?.mapToImage(lngLat)
        if (!at) {
          const text = layer?.visible ? `That was beside the image: tap where ${nameOf(i)} is on it.` : SHOW_IMAGE
          setMessage({ kind: 'warning', text })
          return false
        }
        setMessage(undefined)
        setRows(i, { image: at, misfit: undefined })
      },
    }
    pick = { row: i, request }
    requestTap(request)
  }

  const submit = () => {
    if (picking() !== undefined) cancelTapRequest()
    setFound(undefined)
    setTried(true)
    const complete = completeTowns(unwrap(rows))
    if (complete.towns.length < 2) {
      setMessage({ kind: 'warning', text: 'Pick at least two towns, each with its place and its spot on the image.' })
      return
    }
    const result = matchTowns(map, props.layerId, complete.towns)
    if (!result) {
      setMessage({
        kind: 'warning',
        text: 'The image could not be placed: pick spots farther apart on the image, and check the places.',
      })
      return
    }
    const left = new Set(result.misfits.map((town) => complete.rows[town]))
    setRows(
      produce((list) =>
        list.forEach((row, i) => {
          row.misfit = left.has(i) || undefined
        }),
      ),
    )
    if (rows.every((row) => !rowNote(row))) props.onClose()
    else setMessage(result.note)
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
        Towns far apart work best; they give the image a first placement.
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
                  onInput={(e) => setRows(i(), 'term', e.currentTarget.value)}
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
                  disabled={searching() !== undefined || !row.term.trim()}
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
                            setRows(i(), { place, misfit: undefined })
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
                  <Picked
                    text={place().label}
                    forget={`Forget the place of ${nameOf(i())}`}
                    onForget={() => setRows(i(), { place: undefined, misfit: undefined })}
                  />
                )}
              </Show>
              <Show when={row.image}>
                <Picked
                  text="Spot picked on the image"
                  forget={`Forget the spot of ${nameOf(i())}`}
                  onForget={() => setRows(i(), { image: undefined, misfit: undefined })}
                />
              </Show>
              <Show when={tried() && rowNote(row)}>
                {(note) => (
                  <p class="row-note">
                    {note() === 'place'
                      ? 'Search for it and pick the place from the results.'
                      : note() === 'image'
                        ? 'No spot on the image yet: tap it with the image pin.'
                        : 'Does not fit the others: check the place and the spot.'}
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

/** Something a row has picked, with a button to forget it. */
function Picked(props: { text: string; forget: string; onForget: () => void }) {
  return (
    <div class="row picked">
      <span class="grow name" title={props.text}>
        {props.text}
      </span>
      <button type="button" class="icon" title={props.forget} aria-label={props.forget} onClick={() => props.onForget()}>
        ×
      </button>
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

/** Drags the dialog by its title bar, with mouse, touch or pen. */
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
