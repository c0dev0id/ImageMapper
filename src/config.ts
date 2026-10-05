/** External services and attributions. Keep URLs here, not scattered through the code. */

export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'

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
