import type { Map as MapLibreMap } from 'maplibre-gl'
import { createSignal, For, Show } from 'solid-js'
import { useMapAccessor } from '../map/context.ts'
import { searchViewbox, showBounds } from '../map/navigate.ts'
import { searchPlaces, type Place } from '../search/nominatim.ts'
import { errorMessage } from '../state/ui.ts'

function showPlace(map: MapLibreMap, place: Place): void {
  if (place.bounds) {
    showBounds(map, place.bounds, 16)
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
      const places = await searchPlaces(q, { viewbox: searchViewbox(m) })
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
