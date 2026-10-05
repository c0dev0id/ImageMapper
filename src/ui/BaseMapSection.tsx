import { project, setSatellite } from '../state/project.ts'

export function BaseMapSection() {
  return (
    <section class="section">
      <h2>Base map</h2>
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
