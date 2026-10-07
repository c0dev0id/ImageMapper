import { createResource, For, Show } from 'solid-js'
import { useMapAccessor } from '../map/context.ts'
import {
  activeLayer,
  moveLayer,
  project,
  removeLayer,
  setActiveLayer,
  setLayerBlend,
  setLayerColors,
  setLayerOpacity,
  setLayerTint,
  setLayerVisible,
} from '../state/project.ts'
import { DEFAULT_TINT, type ImageLayer } from '../state/schema.ts'
import { layerNote } from '../state/ui.ts'
import { HelpButton } from '../help/HelpDialog.tsx'
import { BLEND_HELP, colorsHelp } from '../help/topics.tsx'
import { addImages, IMAGE_TYPES } from './addImages.ts'
import { BLEND_MODES } from './blendModes.ts'
import { EditableChoice } from './EditableChoice.tsx'
import { EyeIcon, EyeOffIcon, GripIcon } from './icons.tsx'
import { IMAGE_COLORS } from './imageColors.ts'
import { reorderTarget } from './reorder.ts'
import { thumbnailUrl } from './thumbnails.ts'

export function LayersSection() {
  const map = useMapAccessor()
  // Top layer first, like an image editor's layer list.
  const topFirst = () => [...project.layers].reverse()
  let list!: HTMLUListElement

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
      <ul class="layers" ref={list}>
        <For each={topFirst()}>{(layer) => <LayerEntry layer={layer} list={() => list} />}</For>
      </ul>
      <Show when={activeLayer()} keyed>
        {(layer) => <ActiveLayer layer={layer} />}
      </Show>
    </section>
  )
}

/** Preview and name (a click makes the layer active), visibility, delete and a drag handle. */
function LayerEntry(props: { layer: ImageLayer; list: () => HTMLUListElement }) {
  const layer = props.layer
  const active = () => project.activeLayerId === layer.id
  const [thumbnail] = createResource(() => thumbnailUrl(layer.id, layer.mime))
  let entry!: HTMLLIElement

  return (
    <li ref={entry} class="layer" classList={{ active: active(), hidden: !layer.visible }}>
      <button
        class="icon grip"
        title="Drag to reorder (or use the arrow keys)"
        aria-label={`Reorder ${layer.name}`}
        onPointerDown={(e) => dragToReorder(e, layer, entry, props.list())}
        onKeyDown={(e) => {
          // Up in the list is up in the stack (a higher index).
          const step = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
          if (!step) return
          e.preventDefault()
          moveLayer(layer.id, project.layers.indexOf(layer) + step)
        }}
      >
        <GripIcon />
      </button>
      <button
        class="layer-select"
        title={active() ? layer.name : `Work on ${layer.name}`}
        aria-pressed={active()}
        onClick={() => setActiveLayer(layer.id)}
      >
        <Show when={thumbnail()} fallback={<span class="thumb" />}>
          {(src) => <img class="thumb" src={src()} alt="" />}
        </Show>
        <span class="grow name">{layer.name}</span>
      </button>
      <button
        class="icon"
        title={layer.visible ? 'Hide layer' : 'Show layer'}
        aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        onClick={() => setLayerVisible(layer.id, !layer.visible)}
      >
        {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
      <button class="icon" title="Delete layer" aria-label={`Delete ${layer.name}`} onClick={() => removeLayer(layer.id)}>
        ×
      </button>
    </li>
  )
}

/**
 * Drags a layer entry by its handle: a copy follows the pointer, a line shows where it
 * lands, and dropping moves the layer (one undo step). Works with mouse, touch and pen.
 */
function dragToReorder(e: PointerEvent, layer: ImageLayer, entry: HTMLLIElement, list: HTMLUListElement) {
  if (!e.isPrimary || e.button !== 0) return
  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)
  const entries = [...list.children] as HTMLElement[]
  const from = entries.indexOf(entry)
  const mids = entries.map((el) => {
    const r = el.getBoundingClientRect()
    return r.top + r.height / 2
  })
  const rect = entry.getBoundingClientRect()
  const ghost = entry.cloneNode(true) as HTMLElement
  ghost.classList.add('layer-ghost')
  Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` })
  // Inside the panel, so the copy keeps the panel's button styles; fixed to the viewport.
  const host = entry.closest('.panel') ?? document.body
  host.append(ghost)
  entry.classList.add('dragging')

  let to = from
  const showDrop = () => {
    for (const other of entries) other.classList.remove('drop-before', 'drop-after')
    if (to !== from) entries[to].classList.add(to < from ? 'drop-before' : 'drop-after')
  }
  const move = (ev: PointerEvent) => {
    ghost.style.top = `${rect.top + ev.clientY - e.clientY}px`
    to = reorderTarget(mids, from, ev.clientY)
    showDrop()
  }
  const end = (ev: PointerEvent) => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', end)
    handle.removeEventListener('pointercancel', end)
    ghost.remove()
    entry.classList.remove('dragging')
    const target = to
    to = from
    showDrop()
    // The list shows the top layer first: list position 0 is the top of the stack.
    if (ev.type === 'pointerup' && target !== from) moveLayer(layer.id, entries.length - 1 - target)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}

/** Opacity, blend mode, colours, point pairs and the note of the last skew or town match of the active layer. */
function ActiveLayer(props: { layer: ImageLayer }) {
  const layer = props.layer
  const blend = () => BLEND_MODES.find((m) => m.value === (layer.blend ?? 'normal')) ?? BLEND_MODES[0]
  const colors = () => IMAGE_COLORS.find((c) => c.value === (layer.colors ?? 'original')) ?? IMAGE_COLORS[0]
  const pairs = () => layer.gcps.length
  const note = () => {
    const n = layerNote()
    return n?.layerId === layer.id ? n : undefined
  }
  return (
    <div class="active-layer">
      <div class="row">
        <span class="muted">Opacity</span>
        <input
          class="grow"
          type="range"
          aria-label={`Opacity of ${layer.name}`}
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity}
          onInput={(e) => setLayerOpacity(layer.id, e.currentTarget.valueAsNumber)}
        />
      </div>
      <div class="row">
        <span class="muted">Blend</span>
        <HelpButton label="Explain blend modes" help={() => BLEND_HELP} />
        <EditableChoice
          value={blend().value}
          options={BLEND_MODES}
          label={`Blend mode of ${layer.name}`}
          title="Change the blend mode"
          onChange={(mode) => setLayerBlend(layer.id, mode)}
        />
      </div>
      <div class="row">
        <span class="muted">Colours</span>
        <HelpButton label="Explain colours" help={() => colorsHelp(layer.tint ?? DEFAULT_TINT)} />
        <Show when={layer.colors === 'tinted'}>
          <input
            type="color"
            class="tint"
            aria-label={`Colour of ${layer.name}`}
            title="The colour all printed lines and text are shown in"
            value={layer.tint ?? DEFAULT_TINT}
            onInput={(e) => setLayerTint(layer.id, e.currentTarget.value)}
          />
        </Show>
        <EditableChoice
          value={colors().value}
          options={IMAGE_COLORS}
          label={`Colours of ${layer.name}`}
          title="Change how the colours of the image are shown"
          onChange={(colors) => setLayerColors(layer.id, colors)}
        />
      </div>
      <div class="row">
        <span class="grow muted">
          {pairs()} {pairs() === 1 ? 'pair' : 'pairs'}
        </span>
      </div>
      <Show when={note()}>{(n) => <p class={`note ${n().kind}`}>{n().text}</p>}</Show>
    </div>
  )
}
