import { For } from 'solid-js'
import { BASE_MAPS, type BaseMapId } from '../config.ts'
import { project, setBaseMap, setBaseMapSaturation, setSatelliteOpacity } from '../state/project.ts'
import { PencilIcon } from './icons.tsx'

export function BaseMapSection() {
  return (
    <section class="section">
      <h2>Base map</h2>
      <div class="row base-map">
        <select
          class="grow"
          aria-label="Base map"
          title="Change the base map"
          value={project.baseMap}
          onChange={(e) => setBaseMap(e.currentTarget.value as BaseMapId)}
        >
          <For each={Object.entries(BASE_MAPS)}>{([id, base]) => <option value={id}>{base.label}</option>}</For>
        </select>
        <PencilIcon />
      </div>
      <div class="row">
        <span class="muted">Satellite</span>
        <input
          class="grow"
          type="range"
          aria-label="Satellite opacity"
          title="Esri satellite imagery over the base map; all the way to the left turns it off"
          min="0"
          max="1"
          step="0.05"
          value={project.satelliteOpacity}
          onInput={(e) => setSatelliteOpacity(e.currentTarget.valueAsNumber)}
        />
      </div>
      <div class="row">
        <span class="muted">Colour</span>
        <input
          class="grow"
          type="range"
          aria-label="Colour of the base map"
          title="From grey to full colour, for the base map and the satellite: images stand out against grey"
          min="0"
          max="1"
          step="0.05"
          value={project.baseMapSaturation}
          onInput={(e) => setBaseMapSaturation(e.currentTarget.valueAsNumber)}
        />
      </div>
    </section>
  )
}
