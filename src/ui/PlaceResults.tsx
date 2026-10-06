import { For, Show } from 'solid-js'
import type { Place } from '../search/nominatim.ts'

/** Places found by Nominatim, as buttons, with the credit its usage policy asks for. */
export function PlaceResults(props: { places: Place[]; empty: string; onPick: (place: Place) => void }) {
  return (
    <Show when={props.places.length > 0} fallback={<p class="muted hint">{props.empty}</p>}>
      <ul class="search-results">
        <For each={props.places}>
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
  )
}
