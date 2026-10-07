import { For } from 'solid-js'
import { BASE_MAPS, type BaseMapId } from '../config.ts'
import { project, setBaseMap, setSatellite } from '../state/project.ts'
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
        <label class="grow">
          <input
            type="checkbox"
            checked={project.satellite.visible}
            onChange={(e) => setSatellite({ visible: e.currentTarget.checked })}
          />{' '}
          Satellite (Esri)
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          title="Satellite opacity"
          disabled={!project.satellite.visible}
          value={project.satellite.opacity}
          onInput={(e) => setSatellite({ opacity: e.currentTarget.valueAsNumber })}
        />
      </div>
    </section>
  )
}
