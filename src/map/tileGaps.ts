import { AJAXError, type GetResourceResponse, type RequestParameters } from 'maplibre-gl'

/**
 * The URL scheme of raster tiles from servers that answer zooms they have no data for with
 * transparent tiles instead of an error. `loadTileWithGaps` loads them over https.
 */
export const GAPS_SCHEME = 'gaps'

/** Whether every pixel of RGBA data is fully opaque, as a base map tile with data is. */
export function isOpaque(pixels: Uint8ClampedArray): boolean {
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) return false
  return true
}

let canvas: OffscreenCanvas | undefined

/**
 * Loads a `gaps://` tile. A tile with any pixel that is not fully opaque lies in a gap of
 * the server's coverage, or on its edge, and is reported as a 404: MapLibre then shows the
 * tile of the zoom below, enlarged, as it does for a tile the server does not have. The
 * decoded image goes to MapLibre as it is, so it is not decoded twice.
 */
export async function loadTileWithGaps(
  { url }: RequestParameters,
  abort: AbortController,
): Promise<GetResourceResponse<ImageBitmap>> {
  const response = await fetch(url.replace(`${GAPS_SCHEME}://`, 'https://'), { signal: abort.signal })
  if (!response.ok) throw new AJAXError(response.status, response.statusText, url, await response.blob())
  const image = await createImageBitmap(await response.blob())
  canvas ??= new OffscreenCanvas(image.width, image.height)
  // Setting the size also clears what the previous tile left.
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  if (!isOpaque(context.getImageData(0, 0, image.width, image.height).data)) {
    image.close()
    throw new AJAXError(404, 'Not Found', url, new Blob())
  }
  return { data: image, cacheControl: response.headers.get('Cache-Control'), expires: response.headers.get('Expires') }
}
