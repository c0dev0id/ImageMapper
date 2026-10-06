import type { Map as MapLibreMap } from 'maplibre-gl'
import { For, Show } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { countPairs, prepareSkew } from '../gcp/gcps.ts'
import type { Warp } from '../geo/warp.ts'
import { useMapAccessor } from '../map/context.ts'
import { flyToImage, moveImageHere } from '../map/navigate.ts'
import { warpOf } from '../state/derived.ts'
import {
  moveLayer,
  project,
  removeLayer,
  setActiveLayer,
  setLayerOpacity,
  setLayerPlacement,
  setLayerVisible,
} from '../state/project.ts'
import type { ImageLayer } from '../state/schema.ts'
import { mode, setSkewNote, skewNote, startTransform, stopTransform } from '../state/ui.ts'
import { addImages, IMAGE_TYPES } from './addImages.ts'
import { CrosshairIcon } from './icons.tsx'

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
        <FindImage layer={layer} />
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
          onClick={() => removeLayer(layer.id)}
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
      <Show when={active()}>
        <GeorefStatus layer={layer} />
      </Show>
    </li>
  )
}

function GeorefStatus(props: { layer: ImageLayer }) {
  const layer = props.layer
  const counts = () => countPairs(layer.gcps)
  const note = () => {
    const n = skewNote()
    return n?.layerId === layer.id ? n : undefined
  }
  const skew = () => {
    const result = prepareSkew(unwrap(layer.gcps), layer.width, layer.height)
    if (!result.ok) {
      setSkewNote({ layerId: layer.id, kind: 'error', text: result.error })
      return
    }
    setLayerPlacement(layer.id, result.pairs, 'Skew image to map')
    setSkewNote(result.warning ? { layerId: layer.id, kind: 'warning', text: result.warning } : undefined)
  }
  const transforming = () => mode() === 'transform'
  return (
    <>
      <div class="row">
        <span class="grow muted">Position by hand</span>
        <button
          classList={{ primary: transforming() }}
          title="Drag the image, its corners or its rotate handle on the map"
          disabled={!layer.visible}
          onClick={() => (transforming() ? stopTransform() : startTransform())}
        >
          {transforming() ? 'Done' : 'Move, rotate, resize'}
        </button>
      </div>
      <div class="row">
        <span class="grow muted">
          {counts().complete} {counts().complete === 1 ? 'pair' : 'pairs'}
          {counts().unmatched > 0 ? `, ${counts().unmatched} unmatched` : ''}
        </span>
        <button class="primary" disabled={counts().complete < 3} onClick={skew}>
          Skew image to map
        </button>
      </div>
      <Show when={note()}>{(n) => <p class={`note ${n().kind}`}>{n().text}</p>}</Show>
    </>
  )
}

/** Brings an image that is far off into view: the view to the image, or the image here. */
function FindImage(props: { layer: ImageLayer }) {
  const map = useMapAccessor()
  const layer = props.layer
  const id = `find-image-${layer.id}`
  let button!: HTMLButtonElement
  let popup!: HTMLDivElement

  // A popover lies above everything, so the panel cannot clip it; it opens beside the
  // button, below it or (lower on the screen, as on phones) above it.
  const place = (e: ToggleEvent) => {
    if (e.newState !== 'open') return
    const r = button.getBoundingClientRect()
    const below = r.bottom < innerHeight / 2
    popup.style.top = below ? `${r.bottom + 4}px` : 'auto'
    popup.style.bottom = below ? 'auto' : `${innerHeight - r.top + 4}px`
    popup.style.right = `${innerWidth - r.right}px`
  }
  const run = (action: (m: MapLibreMap, warp: Warp) => void) => {
    popup.hidePopover()
    const m = map()
    const warp = warpOf(layer.id)
    if (m && warp) action(m, warp)
  }

  return (
    <>
      <button
        ref={button}
        class="icon"
        title="Find this image on the map"
        aria-label="Find image"
        popovertarget={id}
        disabled={!map()}
      >
        <CrosshairIcon />
      </button>
      <div ref={popup} id={id} popover class="popup-menu" onBeforeToggle={place}>
        <button onClick={() => run(flyToImage)}>Fly to image</button>
        <button onClick={() => run((m, warp) => moveImageHere(m, layer, warp))}>Move image here</button>
      </div>
    </>
  )
}
