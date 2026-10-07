import { BASE_MAPS, type BaseMapId } from '../config.ts'
import { project, setBaseMap, setBaseMapSaturation, setSatelliteOpacity } from '../state/project.ts'
import { EditableChoice } from './EditableChoice.tsx'

const BASE_MAP_CHOICES = Object.entries(BASE_MAPS).map(([id, base]) => ({ value: id as BaseMapId, label: base.label }))

export function BaseMapSection() {
  return (
    <section class="section">
      <h2>Base map</h2>
      <div class="row">
        <EditableChoice
          value={project.baseMap}
          options={BASE_MAP_CHOICES}
          label="Base map"
          title="Change the base map"
          onChange={setBaseMap}
        />
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
