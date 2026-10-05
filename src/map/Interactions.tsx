import type { MapMouseEvent } from 'maplibre-gl'
import { onCleanup } from 'solid-js'
import { roundLngLat } from '../routing/legs.ts'
import { appendWaypoint } from '../state/project.ts'
import { editingRouteId, menu, mode, setMenu, setSelection, stopDrawing } from '../state/ui.ts'
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
    const routeId = editingRouteId()
    if (mode() === 'route' && routeId) {
      const { lng, lat } = e.lngLat.wrap()
      appendWaypoint(routeId, roundLngLat([lng, lat]))
    } else setSelection(undefined)
  }
  const onMoveStart = () => setMenu(undefined)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (menu()) setMenu(undefined)
    else if (mode() === 'route') stopDrawing()
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
