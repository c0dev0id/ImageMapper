import type { StyleSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { prefixStyle, rasterStyle } from './baseMap.ts'

describe('prefixStyle', () => {
  it('prefixes the ids of sources and layers and the sources layers draw from', () => {
    const style: StyleSpecification = {
      version: 8,
      glyphs: 'https://example.org/fonts/{fontstack}/{range}.pbf',
      sources: { omt: { type: 'vector', url: 'https://example.org/planet' } },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#eee' } },
        { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#9cf' } },
      ],
    }
    expect(prefixStyle(style, 'base/')).toEqual({
      sources: { 'base/omt': { type: 'vector', url: 'https://example.org/planet' } },
      layers: [
        { id: 'base/background', type: 'background', paint: { 'background-color': '#eee' } },
        { id: 'base/water', type: 'fill', source: 'base/omt', 'source-layer': 'water', paint: { 'fill-color': '#9cf' } },
      ],
    })
  })
})

describe('rasterStyle', () => {
  it('shows raster tiles as one layer with their attribution', () => {
    expect(rasterStyle('https://tiles.example.org/{z}/{x}/{y}.png', '© Example')).toEqual({
      version: 8,
      sources: {
        tiles: {
          type: 'raster',
          tiles: ['https://tiles.example.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '© Example',
        },
      },
      layers: [{ id: 'tiles', type: 'raster', source: 'tiles' }],
    })
  })
})
