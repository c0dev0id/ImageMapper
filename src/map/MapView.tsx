import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { onCleanup, onMount } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { ROUTING_ATTRIBUTION } from '../config.ts'
import { project, setView } from '../state/project.ts'
import { baseStyle } from './style.ts'

maplibregl.setWorkerUrl(workerUrl)

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits

/** Creates the map once and reports it when the style has loaded. */
export function MapView(props: { onLoad: (map: maplibregl.Map) => void }) {
  let container!: HTMLDivElement

  onMount(() => {
    const { center, zoom, bearing, pitch } = unwrap(project.view)
    const map = new maplibregl.Map({
      container,
      style: baseStyle(),
      center,
      zoom,
      bearing,
      pitch,
      // The warped image layers draw a single world copy; keep everything else consistent.
      renderWorldCopies: false,
      attributionControl: { compact: true, customAttribution: ROUTING_ATTRIBUTION },
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left')
    map.on('load', () => props.onLoad(map))
    map.on('moveend', () => {
      const c = map.getCenter()
      setView({
        center: [round(c.lng, 6), round(c.lat, 6)],
        zoom: round(map.getZoom(), 3),
        bearing: round(map.getBearing(), 2),
        pitch: round(map.getPitch(), 2),
      })
    })
    onCleanup(() => map.remove())
  })

  return <div ref={container} class="map" />
}
