/** External services and attributions. Keep URLs here, not scattered through the code. */

export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'

/**
 * A base map: raster tiles (256 px, up to `maxzoom`, 19 by default; enlarged beyond), or a
 * MapLibre style, which brings its own attribution.
 */
export type BaseMap = { label: string } & ({ tiles: string; attribution: string; maxzoom?: number } | { style: string })

const OPENTOPOMAP_ATTRIBUTION =
  'Map data: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, SRTM · Map style: © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC-BY-SA</a>)'

/** BKG's terms ask for the year of the last data acquisition: for tiles fetched live, this year. */
const TOPPLUSOPEN_ATTRIBUTION = `© <a href="https://www.bkg.bund.de" target="_blank" rel="noopener">BKG</a> (${new Date().getFullYear()}) <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener">dl-de/by-2-0</a>, <a href="https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_topplusopen.html" target="_blank" rel="noopener">Data sources</a>`

/**
 * The base maps to pick from, in menu order. Vector styles draw their labels at any
 * screen density, so they stay sharp; of the raster maps, OpenTopoMap and TopPlusOpen bake
 * in labels large enough to read.
 */
export const BASE_MAPS = {
  osm: { label: 'OSM Standard', tiles: OSM_TILES, attribution: OSM_ATTRIBUTION },
  opentopomap: {
    label: 'OpenTopoMap',
    tiles: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    maxzoom: 17,
    attribution: OPENTOPOMAP_ATTRIBUTION,
  },
  topplusopen: {
    label: 'TopPlusOpen',
    tiles: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png',
    maxzoom: 18,
    attribution: TOPPLUSOPEN_ATTRIBUTION,
  },
  liberty: { label: 'OpenFreeMap Liberty', style: 'https://tiles.openfreemap.org/styles/liberty' },
  bright: { label: 'OpenFreeMap Bright', style: 'https://tiles.openfreemap.org/styles/bright' },
  colorful: { label: 'VersaTiles Colorful', style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json' },
} as const satisfies Record<string, BaseMap>

export type BaseMapId = keyof typeof BASE_MAPS

export const DEFAULT_BASE_MAP: BaseMapId = 'liberty'

/**
 * Esri World Imagery through the keyless legacy endpoint. Esri's terms cover this only
 * together with Esri software or an ArcGIS subscription; see the README.
 */
export const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
export const SATELLITE_ATTRIBUTION =
  'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community · Powered by <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>'

/** FOSSGIS OSRM servers: one request per second at most, see routing.openstreetmap.de/about.html. */
export const ROUTING_URL = 'https://routing.openstreetmap.de'
export const ROUTING_ATTRIBUTION =
  'Routing: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS OSRM</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Report a map issue</a>'
export const ROUTING_MIN_INTERVAL_MS = 1100
export const ROUTING_TIMEOUT_MS = 15_000

/**
 * Nominatim (OSM's geocoder): searches only on an explicit user action, at most one request
 * per second, identical requests from a cache, no search-as-you-type
 * (operations.osmfoundation.org/policies/nominatim).
 */
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
export const SEARCH_MIN_INTERVAL_MS = 1000
export const SEARCH_TIMEOUT_MS = 10_000

export const SOURCE_URL = 'https://github.com/c0dev0id/mappic'

/** Operator contact required by the FOSSGIS terms, assembled at runtime to keep it from crawlers. */
export const CONTACT_PARTS = ['mappic', 'textmail', 'me']
