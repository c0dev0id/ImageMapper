import type { MapMouseEvent } from 'maplibre-gl'
import { onCleanup } from 'solid-js'
import { menu, mode, setMenu, setSelection } from '../state/ui.ts'
import { useMap } from './context.ts'
import { openGcpMenu } from './gcpMenu.ts'
import { fromMarker } from './markers.ts'

/** Mouse and keyboard handling on the map that depends on the current mode. */
export function Interactions() {
  const map = useMap()

  const onContextMenu = (e: MapMouseEvent) => {
    e.preventDefault()
    if (mode() === 'georef') openGcpMenu(map, e.point, e.lngLat)
  }
  const onClick = (e: MapMouseEvent) => {
    if (fromMarker(e.originalEvent)) return
    setMenu(undefined)
    if (mode() === 'georef') setSelection(undefined)
  }
  const onMoveStart = () => setMenu(undefined)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (menu()) setMenu(undefined)
    else setSelection(undefined)
  }

  map.on('contextmenu', onContextMenu)
  map.on('click', onClick)
  map.on('movestart', onMoveStart)
  document.addEventListener('keydown', onKeyDown)
  onCleanup(() => {
    map.off('contextmenu', onContextMenu)
    map.off('click', onClick)
    map.off('movestart', onMoveStart)
    document.removeEventListener('keydown', onKeyDown)
  })
  return null
}
