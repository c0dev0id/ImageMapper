import { For, Show } from 'solid-js'
import { useMapAccessor } from '../map/context.ts'
import { forgetImageBytes } from '../state/images.ts'
import {
  moveLayer,
  project,
  removeLayer,
  setActiveLayer,
  setLayerOpacity,
  setLayerVisible,
} from '../state/project.ts'
import type { ImageLayer } from '../state/schema.ts'
import { addImages, IMAGE_TYPES } from './addImages.ts'

export function LayersSection() {
  const map = useMapAccessor()
  // Top layer first, like an image editor's layer list.
  const topFirst = () => [...project.layers].reverse()

  return (
    <section class="section">
      <div class="row">
        <h2 class="grow">Image layers</h2>
        <label class="button" classList={{ disabled: !map() }}>
          Add images
          <input
            type="file"
            hidden
            multiple
            accept={IMAGE_TYPES}
            disabled={!map()}
            onChange={async (e) => {
              const input = e.currentTarget
              const files = [...(input.files ?? [])]
              input.value = ''
              const m = map()
              if (m) await addImages(files, m)
            }}
          />
        </label>
      </div>
      <Show when={project.layers.length === 0}>
        <p class="muted hint">
          Move the map to the area of the tour, then add photos or scans of the printed map.
        </p>
      </Show>
      <ul class="layers">
        <For each={topFirst()}>{(layer) => <LayerRow layer={layer} />}</For>
      </ul>
    </section>
  )
}

function LayerRow(props: { layer: ImageLayer }) {
  const layer = props.layer
  const index = () => project.layers.indexOf(layer)
  const active = () => project.activeLayerId === layer.id

  return (
    <li class="layer" classList={{ active: active() }}>
      <div class="row">
        <input
          type="radio"
          name="active-layer"
          title="Work on this layer"
          checked={active()}
          onChange={() => setActiveLayer(layer.id)}
        />
        <input
          type="checkbox"
          title="Show layer"
          checked={layer.visible}
          onChange={(e) => setLayerVisible(layer.id, e.currentTarget.checked)}
        />
        <span class="grow name" title={layer.name} onClick={() => setActiveLayer(layer.id)}>
          {layer.name}
        </span>
        <button
          class="icon"
          title="Move up"
          disabled={index() === project.layers.length - 1}
          onClick={() => moveLayer(layer.id, 1)}
        >
          ↑
        </button>
        <button class="icon" title="Move down" disabled={index() === 0} onClick={() => moveLayer(layer.id, -1)}>
          ↓
        </button>
        <button
          class="icon"
          title="Delete layer"
          onClick={() => {
            if (!confirm(`Delete the layer "${layer.name}" and its points?`)) return
            removeLayer(layer.id)
            forgetImageBytes(layer.id)
          }}
        >
          ×
        </button>
      </div>
      <div class="row">
        <span class="muted">Opacity</span>
        <input
          class="grow"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity}
          onInput={(e) => setLayerOpacity(layer.id, e.currentTarget.valueAsNumber)}
        />
      </div>
    </li>
  )
}
