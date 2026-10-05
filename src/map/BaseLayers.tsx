import { createEffect } from 'solid-js'
import { project } from '../state/project.ts'
import { useMap } from './context.ts'

/** Keeps the satellite layer in sync with the project settings. */
export function BaseLayers() {
  const map = useMap()
  createEffect(() => {
    map.setLayoutProperty('satellite', 'visibility', project.satellite.visible ? 'visible' : 'none')
  })
  createEffect(() => {
    map.setPaintProperty('satellite', 'raster-opacity', project.satellite.opacity)
  })
  return null
}
