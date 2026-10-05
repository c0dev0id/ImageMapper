import type { Map as MapLibreMap } from 'maplibre-gl'
import { createSignal, For, Show } from 'solid-js'
import { useMapAccessor } from '../map/context.ts'
import { createPlaceSearch, type Place, type Viewbox } from '../search/nominatim.ts'
import { errorMessage } from '../state/ui.ts'

const search = createPlaceSearch()

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))

/** The visible area, used to prefer nearby results; omitted when looking at a continent. */
function viewbox(map: MapLibreMap): Viewbox | undefined {
  if (map.getZoom() < 6) return undefined
  const b = map.getBounds()
  return [clamp(b.getWest(), 180), clamp(b.getSouth(), 85), clamp(b.getEast(), 180), clamp(b.getNorth(), 85)]
}

function showPlace(map: MapLibreMap, place: Place): void {
  if (place.bounds) {
    const [west, south, east, north] = place.bounds
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 40, maxZoom: 16, bearing: map.getBearing() },
    )
  } else {
    map.flyTo({ center: place.center, zoom: 15 })
  }
}

/** Address and place search (Nominatim) to move the map to an area. */
export function SearchSection() {
  const map = useMapAccessor()
  const [query, setQuery] = createSignal('')
  const [results, setResults] = createSignal<Place[]>()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string>()

  const submit = async (e: SubmitEvent) => {
    e.preventDefault()
    const m = map()
    const q = query().trim()
    if (!m || !q || busy()) return
    setBusy(true)
    setError(undefined)
    try {
      const places = await search(q, viewbox(m))
      if (places.length === 1) {
        showPlace(m, places[0])
        setResults(undefined)
      } else setResults(places)
    } catch (err) {
      setResults(undefined)
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const choose = (place: Place) => {
    const m = map()
    if (m) showPlace(m, place)
    setResults(undefined)
  }

  return (
    <section class="section">
      <form class="row" role="search" onSubmit={submit}>
        <input
          class="grow"
          type="search"
          placeholder="Find a place or address"
          aria-label="Find a place or address"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setResults(undefined)
          }}
        />
        <button type="submit" disabled={busy() || !query().trim() || !map()}>
          {busy() ? 'Searching…' : 'Search'}
        </button>
      </form>
      <Show when={error()}>{(text) => <p class="note error">{text()}</p>}</Show>
      <Show when={results()}>
        {(list) => (
          <Show when={list().length > 0} fallback={<p class="muted hint">Nothing found.</p>}>
            <ul class="search-results">
              <For each={list()}>
                {(place) => (
                  <li>
                    <button class="result" onClick={() => choose(place)}>
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
    </section>
  )
}
