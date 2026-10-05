import { Show } from 'solid-js'
import { gcpNumber } from '../gcp/gcps.ts'
import { activeLayer } from '../state/project.ts'
import { mode, selection } from '../state/ui.ts'

/** A short instruction for the current state, shown over the map. */
export function HintBar() {
  const text = () => {
    if (mode() !== 'georef') return undefined
    const layer = activeLayer()
    if (!layer) return undefined
    const sel = selection()
    if (sel && sel.layerId === layer.id) {
      const n = gcpNumber(layer.gcps, sel.gcpId)
      return sel.side === 'image'
        ? `Image point ${n} selected: right-click the same place on the map and choose "Match point on map".`
        : `Map point ${n} selected: right-click the same place on the image and choose "Match point on image".`
    }
    return 'Right-click a feature on the image, then the same feature on the map. Skew the image with 3 or more pairs.'
  }
  return (
    <Show when={text()}>
      <div class="hint-bar">{text()}</div>
    </Show>
  )
}
