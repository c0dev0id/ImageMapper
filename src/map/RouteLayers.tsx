import type { GeoJSONSource } from 'maplibre-gl'
import type { Feature, LineString } from 'geojson'
import { createEffect } from 'solid-js'
import type { LngLat } from '../geo/types.ts'
import { legGeometry, routeLegs } from '../routing/legs.ts'
import { decodePolyline } from '../routing/polyline.ts'
import { failedLegs } from '../routing/service.ts'
import { project } from '../state/project.ts'
import { useMap } from './context.ts'

/** Decoded leg geometries; polyline strings are immutable, so they are their own cache key. */
let decoded = new Map<string, LngLat[]>()

/** Draws all routes: routed and straight legs solid, pending legs grey dashed, failed legs red dashed. */
export function RouteLayers() {
  const map = useMap()
  createEffect(() => {
    const failed = failedLegs()
    const cache = new Map<string, LngLat[]>()
    const features: Feature<LineString>[] = []
    for (const route of project.routes) {
      for (const leg of routeLegs(route)) {
        const geometry = legGeometry(route, leg)
        let coordinates: LngLat[]
        let state: string
        if (geometry) {
          coordinates = decoded.get(geometry) ?? decodePolyline(geometry)
          cache.set(geometry, coordinates)
          state = 'routed'
        } else {
          coordinates = [
            [leg.from[0], leg.from[1]],
            [leg.to[0], leg.to[1]],
          ]
          state = leg.straight ? 'straight' : failed.has(leg.key) ? 'failed' : 'pending'
        }
        features.push({
          type: 'Feature',
          properties: { state, color: route.color },
          geometry: { type: 'LineString', coordinates },
        })
      }
    }
    decoded = cache
    void map.getSource<GeoJSONSource>('routes')?.setData({ type: 'FeatureCollection', features })
  })
  return null
}
