/** External services and attributions. Keep URLs here, not scattered through the code. */

export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'

/** Where a base map has its data: the world, or one country or state. */
export type Region = 'World' | 'Austria' | 'France' | 'Germany' | 'Norway' | 'Switzerland' | 'USA'

/**
 * A raster base map: 256 px tiles, an XYZ template or a WMS GetMap request with
 * `{bbox-epsg-3857}`. Tiles are fetched from `minzoom` (0 by default) to `maxzoom` (19 by
 * default; enlarged beyond) and only within `bounds` (west, south, east, north), where a
 * regional map has data. `transparentGaps` marks a server that answers zooms it has no data
 * for in some areas with transparent tiles: a tile that is not fully opaque is treated as
 * missing, so the tile of the zoom below shows, enlarged.
 */
export interface RasterBaseMap {
  tiles: string
  attribution: string
  minzoom?: number
  maxzoom?: number
  bounds?: readonly [number, number, number, number]
  transparentGaps?: boolean
}

/** A base map: raster tiles, or a MapLibre style, which brings its own attribution. */
export type BaseMap = { label: string; region: Region } & (RasterBaseMap | { style: string })

/** Data year for terms that ask for the year the data was fetched: tiles are fetched live. */
const YEAR = new Date().getFullYear()

/** A WMS layer as 256 px tiles in Web Mercator: MapLibre fills in each tile's bounding box. */
const wms = (service: string, layer: string, version: '1.1.1' | '1.3.0') =>
  `${service}?SERVICE=WMS&VERSION=${version}&REQUEST=GetMap&LAYERS=${layer}&STYLES=` +
  `&${version === '1.3.0' ? 'CRS' : 'SRS'}=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png`

const link = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`

const OPENTOPOMAP_ATTRIBUTION =
  'Map data: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, SRTM · Map style: © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC-BY-SA</a>)'

/** BKG's terms ask for the year of the last data acquisition. */
const TOPPLUSOPEN_ATTRIBUTION = `© <a href="https://www.bkg.bund.de" target="_blank" rel="noopener">BKG</a> (${YEAR}) <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener">dl-de/by-2-0</a>, <a href="https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_topplusopen.html" target="_blank" rel="noopener">Data sources</a>`

const CYCLOSM_ATTRIBUTION = `Map style: <a href="https://www.cyclosm.org" target="_blank" rel="noopener">CyclOSM</a>, hosted by <a href="https://www.openstreetmap.fr" target="_blank" rel="noopener">OpenStreetMap France</a> · Map data: ${OSM_ATTRIBUTION}`

/**
 * The base maps to pick from, in menu order: the world first, then by country, each
 * region's maps together, as the menu groups them. Vector styles draw their labels at any
 * screen density, so they stay sharp; of the raster maps, OpenTopoMap and TopPlusOpen bake
 * in labels large enough to read, and CyclOSM shows tracks and trails with their surface
 * and difficulty. The regional maps are the official topographic maps, with every track.
 */
export const BASE_MAPS = {
  osm: { label: 'OSM Standard', region: 'World', tiles: OSM_TILES, attribution: OSM_ATTRIBUTION },
  opentopomap: {
    label: 'OpenTopoMap',
    region: 'World',
    tiles: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    maxzoom: 17,
    attribution: OPENTOPOMAP_ATTRIBUTION,
  },
  topplusopen: {
    label: 'TopPlusOpen',
    region: 'World',
    tiles: 'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png',
    // Data to z18 in central Europe, z16 in the rest of Europe, z13 elsewhere.
    maxzoom: 18,
    transparentGaps: true,
    attribution: TOPPLUSOPEN_ATTRIBUTION,
  },
  cyclosm: {
    label: 'CyclOSM',
    region: 'World',
    tiles: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    maxzoom: 20,
    attribution: CYCLOSM_ATTRIBUTION,
  },
  liberty: { label: 'OpenFreeMap Liberty', region: 'World', style: 'https://tiles.openfreemap.org/styles/liberty' },
  bright: { label: 'OpenFreeMap Bright', region: 'World', style: 'https://tiles.openfreemap.org/styles/bright' },
  positron: { label: 'OpenFreeMap Positron', region: 'World', style: 'https://tiles.openfreemap.org/styles/positron' },
  colorful: {
    label: 'VersaTiles Colorful',
    region: 'World',
    style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json',
  },
  basemapat: {
    label: 'basemap.at',
    region: 'Austria',
    tiles: 'https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/{z}/{y}/{x}.png',
    maxzoom: 20,
    bounds: [9.5, 46.3, 17.2, 49.1],
    attribution: `Data source: ${link('https://basemap.at', 'basemap.at')}, CC BY 4.0`,
  },
  planign: {
    label: 'Plan IGN',
    region: 'France',
    tiles:
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' +
      '&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    bounds: [-5.3, 41.3, 9.7, 51.2],
    attribution: `© ${link('https://www.ign.fr', 'IGN')} (${YEAR}), Licence Ouverte Etalab 2.0`,
  },
  basemapde: {
    label: 'basemap.de',
    region: 'Germany',
    tiles:
      'https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_farbe/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png',
    bounds: [5.8, 47.2, 15.1, 55.1],
    attribution: `© GeoBasis-DE / ${link('https://basemap.de', 'BKG')} (${YEAR}) CC BY 4.0`,
  },
  dtk25bw: {
    label: 'Baden-Württemberg 1:25 000',
    region: 'Germany',
    tiles: wms('https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DTK_25_K_A', 'RDS_LY_DTK25K_COL', '1.1.1'),
    maxzoom: 17,
    bounds: [7.5, 47.5, 10.5, 49.8],
    attribution: `${link('https://www.lgl-bw.de', 'LGL-BW')} (${YEAR}) Datenlizenz Deutschland – Namensnennung – Version 2.0`,
  },
  dtk25by: {
    label: 'Bavaria 1:25 000',
    region: 'Germany',
    tiles: wms('https://geoservices.bayern.de/od/wms/dtk/v1/dtk25', 'by_dtk25', '1.1.1'),
    // The service draws nothing at smaller scales.
    minzoom: 12,
    maxzoom: 17,
    bounds: [8.9, 47.2, 13.9, 50.6],
    attribution: `© ${link('https://www.geodaten.bayern.de', 'Bayerische Vermessungsverwaltung')}, CC BY 4.0`,
  },
  dtknrw: {
    label: 'North Rhine-Westphalia topographic',
    region: 'Germany',
    tiles: wms('https://www.wms.nrw.de/geobasis/wms_nw_dtk', 'nw_dtk_col', '1.3.0'),
    maxzoom: 18,
    bounds: [5.8, 50.3, 9.5, 52.6],
    attribution: `© ${link('https://www.bezreg-koeln.nrw.de/geobasis-nrw', 'Geobasis NRW')} (${YEAR}), dl-de/zero-2-0`,
  },
  dtk25rp: {
    label: 'Rhineland-Palatinate 1:25 000',
    region: 'Germany',
    tiles: wms('https://geo4.service24.rlp.de/wms/rp_dtk25.fcgi', 'rp_dtk25', '1.3.0'),
    maxzoom: 17,
    bounds: [6.1, 48.9, 8.6, 51.0],
    attribution: `©GeoBasis-DE / ${link('https://lvermgeo.rlp.de', 'LVermGeoRP')} (${YEAR}), dl-de/by-2-0`,
  },
  kartverket: {
    label: 'Kartverket Topo',
    region: 'Norway',
    tiles: 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png',
    maxzoom: 18,
    bounds: [4.0, 57.9, 31.3, 71.3],
    attribution: `© ${link('https://www.kartverket.no', 'Kartverket')}, CC BY 4.0`,
  },
  swisstopo: {
    label: 'swisstopo National Map',
    region: 'Switzerland',
    tiles: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    bounds: [5.9, 45.8, 10.5, 47.9],
    attribution: `© ${link('https://www.swisstopo.admin.ch', 'swisstopo')}`,
  },
  usgstopo: {
    label: 'USGS Topo',
    region: 'USA',
    tiles: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 16,
    bounds: [-179.2, 18.9, -66.9, 71.4],
    attribution: `${link('https://www.usgs.gov/programs/national-geospatial-program/national-map', 'USGS The National Map')}`,
  },
} as const satisfies Record<string, BaseMap>

export type BaseMapId = keyof typeof BASE_MAPS

export const DEFAULT_BASE_MAP: BaseMapId = 'liberty'

/**
 * Esri World Imagery through the keyless legacy endpoint. Esri's terms cover this only
 * together with Esri software or an ArcGIS subscription; see the README. Where a zoom has no
 * imagery, `blankTile=false` makes the server answer 404 instead of a grey "Map data not yet
 * available" tile, so that MapLibre shows the tile of the zoom below, enlarged.
 */
export const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false'
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
