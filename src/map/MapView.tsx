import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { onCleanup, onMount } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { ROUTING_ATTRIBUTION } from '../config.ts'
import { project, setView } from '../state/project.ts'
import { notify } from '../state/ui.ts'
import { baseStyle } from './style.ts'
import { GAPS_SCHEME, loadTileWithGaps } from './tileGaps.ts'

maplibregl.setWorkerUrl(workerUrl)
maplibregl.addProtocol(GAPS_SCHEME, loadTileWithGaps)

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits

/** Creates the map once and reports it when the style has loaded. */
export function MapView(props: { onLoad: (map: maplibregl.Map) => void }) {
  let container!: HTMLDivElement

  onMount(() => {
    const { center, zoom, bearing, pitch } = unwrap(project.view)
    const credits = new maplibregl.AttributionControl({ compact: true, customAttribution: ROUTING_ATTRIBUTION })
    const map = new maplibregl.Map({
      container,
      style: baseStyle(),
      center,
      zoom,
      bearing,
      pitch,
      // The warped image layers draw a single world copy; keep everything else consistent.
      renderWorldCopies: false,
      attributionControl: false,
    })
    map.addControl(credits)
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    // One-shot "locate me": centres the map on the device position and marks it.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 15_000 },
      fitBoundsOptions: { maxZoom: 15 },
    })
    geolocate.on('error', (e) => {
      notify(
        e.code === 1 // PERMISSION_DENIED
          ? 'The browser does not allow access to your location.'
          : `Your location is not available: ${e.message}`,
      )
    })
    map.addControl(geolocate, 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left')
    let stopFolding: (() => void) | undefined
    map.on('load', () => {
      stopFolding = foldCredits(map, credits)
      props.onLoad(map)
    })
    map.on('moveend', () => {
      const c = map.getCenter()
      setView({
        center: [round(c.lng, 6), round(c.lat, 6)],
        zoom: round(map.getZoom(), 3),
        bearing: round(map.getBearing(), 2),
        pitch: round(map.getPitch(), 2),
      })
    })
    onCleanup(() => {
      stopFolding?.()
      map.remove()
    })
  })

  return <div ref={container} class="map" />
}

/**
 * The map credits start open and fold into their (i) after five seconds or at the first
 * pan, zoom or click, as the OSMF attribution guidelines allow. MapLibre's compact control
 * folds by itself only at a drag; the other cases call the same method. Returns the clean-up.
 */
function foldCredits(map: maplibregl.Map, credits: maplibregl.AttributionControl): () => void {
  const fold = () => {
    stop()
    credits._updateCompactMinimize()
  }
  const stop = () => {
    clearTimeout(timer)
    map.off('movestart', fold)
    map.off('click', fold)
  }
  const timer = setTimeout(fold, 5000)
  map.on('movestart', fold)
  map.on('click', fold)
  return stop
}
