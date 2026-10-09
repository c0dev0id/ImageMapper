import type { Map as MapLibreMap } from 'maplibre-gl'
import { createSignal, onMount, Show } from 'solid-js'
import { BaseLayers } from './map/BaseLayers.tsx'
import { MapContext } from './map/context.ts'
import { ContextMenu } from './map/ContextMenu.tsx'
import { GcpLinks, GcpMarkers } from './map/GcpMarkers.tsx'
import { HintBar } from './map/HintBar.tsx'
import { ImageLayers } from './map/ImageLayers.tsx'
import { ImageTransform } from './map/ImageTransform.tsx'
import { Interactions } from './map/Interactions.tsx'
import { RouteEditor } from './map/RouteEditor.tsx'
import { RouteLayers } from './map/RouteLayers.tsx'
import { MapView } from './map/MapView.tsx'
import { Toolbar } from './map/Toolbar.tsx'
import { Waypoints } from './map/Waypoints.tsx'
import { HelpDialog } from './help/HelpDialog.tsx'
import { showHelpOnce } from './help/help.ts'
import { ABOUT_HELP } from './help/topics.tsx'
import { initPersistence } from './state/persistence.ts'
import { errorMessage, notify } from './state/ui.ts'
import { Panel } from './ui/Panel.tsx'
import { MatchTownsDialog } from './match/MatchTownsDialog.tsx'
import { WaypointDialog } from './ui/WaypointDialog.tsx'

export function App() {
  const [loaded, setLoaded] = createSignal(false)
  const [map, setMap] = createSignal<MapLibreMap>()

  // The map is created after the stored project is restored, so it starts at the saved view.
  onMount(async () => {
    try {
      await initPersistence()
    } catch (error) {
      notify(`Browser storage failed, work will not be kept: ${errorMessage(error)}`)
    } finally {
      setLoaded(true)
      // The first visit starts with what Image Mapper is for.
      showHelpOnce('about', ABOUT_HELP)
    }
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
              <ImageLayers />
              <RouteLayers />
              <Waypoints />
              <GcpLinks />
              <GcpMarkers />
              <RouteEditor />
              <ImageTransform />
              <Interactions />
              <ContextMenu />
              <HintBar />
              <Toolbar />
            </Show>
          </main>
        </div>
        <WaypointDialog />
        <Show when={map()}>
          <MatchTownsDialog />
        </Show>
        <HelpDialog />
      </MapContext.Provider>
    </Show>
  )
}
