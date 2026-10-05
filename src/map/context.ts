import type { Map as MapLibreMap } from 'maplibre-gl'
import { createContext, useContext, type Accessor } from 'solid-js'

export const MapContext = createContext<Accessor<MapLibreMap | undefined>>(() => undefined)

/** The map, for components that are only rendered once it has loaded. */
export function useMap(): MapLibreMap {
  const map = useContext(MapContext)()
  if (!map) throw new Error('useMap() called before the map was ready.')
  return map
}

/** The map accessor, for components that render before the map exists. */
export function useMapAccessor(): Accessor<MapLibreMap | undefined> {
  return useContext(MapContext)
}
