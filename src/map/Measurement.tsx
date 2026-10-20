import { LngLat as MapLibreLngLat, type GeoJSONSource } from 'maplibre-gl'
import type { Feature, LineString } from 'geojson'
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
  return (
    <Show when={tool() === 'measure'}>
      <MeasureLine />
      <MeasureEnd index={0} />
      <MeasureEnd index={1} />
    </Show>
  )
}

function MeasureLine() {
  const map = useMap()
  const source = () => map.getSource<GeoJSONSource>('measure')
  createEffect(() => {
    const ends = measurement()
    const features: Feature<LineString>[] =
      ends.length === 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ends } }] : []
    void source()?.setData({ type: 'FeatureCollection', features })
  })
  onCleanup(() => void source()?.setData(EMPTY_COLLECTION))
  return null
}

function MeasureEnd(props: { index: number }) {
  const map = useMap()
  const index = props.index
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
  return null
}
