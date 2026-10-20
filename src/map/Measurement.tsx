import { LngLat as MapLibreLngLat, type GeoJSONSource } from 'maplibre-gl'
import { createEffect, onCleanup, Show } from 'solid-js'
import { measurement, setMeasurement, tool } from '../state/ui.ts'
import { useMap } from './context.ts'
import { formatDistance } from './distance.ts'
import { MarkerHandle } from './markers.ts'
import { EMPTY_COLLECTION } from './style.ts'

/** The great-circle distance between the ends of the measurement, once both are set. */
const distance = () => {
  const [start, end] = measurement()
  return start && end ? formatDistance(MapLibreLngLat.convert(start).distanceTo(MapLibreLngLat.convert(end))) : ''
}

/**
 * The distance being measured, while the measure tool is picked: a dashed line between
 * two draggable ends, with the distance beside the second.
 */
export function Measurement() {
  const map = useMap()
  createEffect(() => {
    const ends = measurement()
    void map.getSource<GeoJSONSource>('measure')?.setData(
      ends.length === 2
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ends } }
        : EMPTY_COLLECTION,
    )
  })
  return (
    <Show when={tool() === 'measure'}>
      <MeasureEnds />
    </Show>
  )
}

/** The ends of the measurement; the measurement is dropped with them when the tool is left. */
function MeasureEnds() {
  const map = useMap()
  for (const index of [0, 1]) {
    const content = (
      <div class="measure-end">{index === 1 && <span class="measure-distance">{distance()}</span>}</div>
    ) as HTMLElement
    const handle = new MarkerHandle(map, content, { className: 'measure-end-marker', draggable: true })
    createEffect(() => handle.setPosition(measurement()[index]))
    // Measured anew all along the drag, not only where the end is dropped.
    handle.marker.on('drag', () => {
      const { lng, lat } = handle.marker.getLngLat().wrap()
      setMeasurement((ends) => ends.with(index, [lng, lat]))
    })
    onCleanup(() => handle.remove())
  }
  onCleanup(() => setMeasurement([]))
  return null
}
