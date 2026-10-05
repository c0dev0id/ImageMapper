import type { Map as MapLibreMap } from 'maplibre-gl'
import { createSignal, onMount, Show } from 'solid-js'
import { BaseLayers } from './map/BaseLayers.tsx'
import { MapContext } from './map/context.ts'
import { MapView } from './map/MapView.tsx'
import { initPersistence } from './state/persistence.ts'
import { Panel } from './ui/Panel.tsx'

export function App() {
  const [loaded, setLoaded] = createSignal(false)
  const [map, setMap] = createSignal<MapLibreMap>()

  // The map is created after the stored project is restored, so it starts at the saved view.
  onMount(async () => {
    await initPersistence()
    setLoaded(true)
  })

  return (
    <Show when={loaded()} fallback={<div class="loading">Loading…</div>}>
      <MapContext.Provider value={map}>
        <div class="app">
          <Panel />
          <main class="map-wrap">
            <MapView onLoad={setMap} />
            <Show when={map()}>
              <BaseLayers />
            </Show>
          </main>
        </div>
      </MapContext.Provider>
    </Show>
  )
}
