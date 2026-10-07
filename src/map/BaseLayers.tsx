import { createEffect } from 'solid-js'
import { BASE_MAPS, DEFAULT_BASE_MAP } from '../config.ts'
import { project } from '../state/project.ts'
import { errorMessage, notify } from '../state/ui.ts'
import { BaseMapSwitcher } from './baseMap.ts'
import { useMap } from './context.ts'
import { SATELLITE_LAYER } from './style.ts'

/** Keeps the base map and the satellite layer in sync with the project settings. */
export function BaseLayers() {
  const map = useMap()
  const baseMaps = new BaseMapSwitcher(map, SATELLITE_LAYER)
  createEffect(() => {
    const base = BASE_MAPS[project.baseMap] ?? BASE_MAPS[DEFAULT_BASE_MAP]
    baseMaps.show(base).catch((error) => notify(`The base map could not be loaded: ${errorMessage(error)}`))
  })
  createEffect(() => {
    map.setLayoutProperty(SATELLITE_LAYER, 'visibility', project.satellite.visible ? 'visible' : 'none')
  })
  createEffect(() => {
    map.setPaintProperty(SATELLITE_LAYER, 'raster-opacity', project.satellite.opacity)
  })
  return null
}
