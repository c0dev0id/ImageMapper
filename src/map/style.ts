import type { MapOptions } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { OSM_ATTRIBUTION, OSM_TILES, SATELLITE_ATTRIBUTION, SATELLITE_TILES } from '../config.ts'

type StyleSpecification = Exclude<MapOptions['style'], string | undefined>

export const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Image layers are inserted directly below this layer, so routes are always drawn on top. */
export const FIRST_OVERLAY_LAYER = 'routes-casing'

/** Transparent footprint of the image being moved; pointer events on it start a move. */
export const IMAGE_HIT_LAYER = 'image-hit'

const round = { 'line-join': 'round', 'line-cap': 'round' } as const

export function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [OSM_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution: OSM_ATTRIBUTION,
      },
      satellite: {
        type: 'raster',
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution: SATELLITE_ATTRIBUTION,
      },
      routes: { type: 'geojson', data: EMPTY_COLLECTION },
      'gcp-links': { type: 'geojson', data: EMPTY_COLLECTION },
      'image-frame': { type: 'geojson', data: EMPTY_COLLECTION },
    },
    layers: [
      { id: 'osm', type: 'raster', source: 'osm' },
      { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
      {
        id: 'routes-casing',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'state'], 'routed'],
        layout: round,
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.85 },
      },
      {
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'state'], 'routed'],
        layout: round,
        paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
      },
      {
        id: 'routes-unrouted',
        type: 'line',
        source: 'routes',
        filter: ['!=', ['get', 'state'], 'routed'],
        paint: {
          'line-color': ['match', ['get', 'state'], 'failed', '#d9480f', '#495057'],
          'line-width': 2.5,
          'line-dasharray': [2, 2],
        },
      },
      {
        id: 'gcp-links',
        type: 'line',
        source: 'gcp-links',
        paint: { 'line-color': '#e8590c', 'line-width': 1.5, 'line-dasharray': [3, 2] },
      },
      {
        id: IMAGE_HIT_LAYER,
        type: 'fill',
        source: 'image-frame',
        paint: { 'fill-opacity': 0 },
      },
      {
        id: 'image-frame',
        type: 'line',
        source: 'image-frame',
        paint: { 'line-color': '#1c7ed6', 'line-width': 2, 'line-dasharray': [3, 2] },
      },
    ],
  }
}
