import type { LayerSpecification, Map as MapLibreMap, SourceSpecification, StyleSpecification } from 'maplibre-gl'
import type { BaseMap, RasterBaseMap } from '../config.ts'
import { GAPS_SCHEME } from './tileGaps.ts'

/** Ids of the base map's sources and layers start with this, apart from the app's own. */
const PREFIX = 'base/'

/**
 * A raster base map as a one-layer style: its tiles fetched between its zooms and within its
 * bounds, where a regional map has data, and shown enlarged beyond its highest zoom. Tiles
 * of a map with transparent gaps go through the `gaps` loader, which reports them missing.
 */
export function rasterStyle({ tiles, attribution, minzoom, maxzoom = 19, bounds, transparentGaps }: RasterBaseMap): StyleSpecification {
  return {
    version: 8,
    sources: {
      tiles: {
        type: 'raster',
        tiles: [transparentGaps ? tiles.replace(/^https:/, `${GAPS_SCHEME}:`) : tiles],
        tileSize: 256,
        ...(minzoom !== undefined && { minzoom }),
        maxzoom,
        ...(bounds && { bounds: [...bounds] }),
        attribution,
      },
    },
    layers: [{ id: 'tiles', type: 'raster', source: 'tiles' }],
  }
}

/** A style's sources and layers under prefixed ids, ready to join another style. */
export function prefixStyle(
  style: StyleSpecification,
  prefix: string,
): { sources: Record<string, SourceSpecification>; layers: LayerSpecification[] } {
  return {
    sources: Object.fromEntries(Object.entries(style.sources).map(([id, source]) => [prefix + id, source])),
    layers: style.layers.map(
      (layer) =>
        ('source' in layer
          ? { ...layer, id: prefix + layer.id, source: prefix + layer.source }
          : { ...layer, id: prefix + layer.id }) as LayerSpecification,
    ),
  }
}

const styles = new Map<string, Promise<StyleSpecification>>()

/** Fetches a style once per session; a failed fetch is tried again next time. */
function loadStyle(url: string): Promise<StyleSpecification> {
  let style = styles.get(url)
  if (!style) {
    style = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`The map style answered with status ${response.status}.`)
      return (await response.json()) as StyleSpecification
    })
    style.catch(() => styles.delete(url))
    styles.set(url, style)
  }
  return style
}

/**
 * Shows a base map below the app's own layers. The map's style stays in place: the base
 * map's sources and layers are swapped inside it, since a style change would drop the
 * custom image layers. Its fonts and icons replace the previous ones; its projection, sky
 * and light are left out. When base maps are picked in quick succession, the last one wins.
 */
export class BaseMapSwitcher {
  private sources: string[] = []
  private layers: string[] = []
  private latest = 0

  constructor(
    private readonly map: MapLibreMap,
    /** The layer the base map is inserted below. */
    private readonly below: string,
  ) {}

  async show(base: BaseMap): Promise<void> {
    const ticket = ++this.latest
    const style = 'style' in base ? await loadStyle(base.style) : rasterStyle(base)
    if (ticket !== this.latest) return
    for (const id of this.layers) this.map.removeLayer(id)
    for (const id of this.sources) this.map.removeSource(id)
    if (style.glyphs) this.map.setGlyphs(style.glyphs)
    this.map.setSprite(typeof style.sprite === 'string' ? style.sprite : null)
    if (Array.isArray(style.sprite)) for (const { id, url } of style.sprite) this.map.addSprite(id, url)
    const { sources, layers } = prefixStyle(style, PREFIX)
    for (const [id, source] of Object.entries(sources)) this.map.addSource(id, source)
    for (const layer of layers) this.map.addLayer(layer, this.below)
    this.sources = Object.keys(sources)
    this.layers = layers.map((layer) => layer.id)
  }
}
