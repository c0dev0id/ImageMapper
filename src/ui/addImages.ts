import type { Map as MapLibreMap } from 'maplibre-gl'
import { initialPlacement } from '../geo/warp.ts'
import { addImageBytes } from '../state/images.ts'
import { requestPersistentStorage, storeImage } from '../state/persistence.ts'
import { addLayer } from '../state/project.ts'
import { errorMessage, notify } from '../state/ui.ts'

export const IMAGE_TYPES = 'image/jpeg,image/png,image/webp'

/** Adds image files as layers, placed north-up in the middle of the current view. */
export async function addImages(files: File[], map: MapLibreMap): Promise<void> {
  for (const file of files) {
    try {
      const bytes = await file.arrayBuffer()
      const mime = file.type || 'image/jpeg'
      // Decode once to get the size after EXIF orientation; GCP pixels refer to it.
      const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }), {
        imageOrientation: 'from-image',
      })
      const { width, height } = bitmap
      bitmap.close()

      const center = map.getCenter()
      const container = map.getContainer()
      const placement = initialPlacement(
        width,
        height,
        [center.lng, center.lat],
        map.getZoom(),
        container.clientWidth,
        container.clientHeight,
      )
      const id = crypto.randomUUID()
      try {
        await storeImage(id, bytes)
        requestPersistentStorage()
      } catch (error) {
        notify(`${file.name} could not be stored in the browser and will be lost on reload: ${errorMessage(error)}`)
      }
      addImageBytes(id, bytes)
      addLayer({ id, name: file.name, mime, width, height, visible: true, opacity: 1, placement, gcps: [] })
    } catch (error) {
      notify(`${file.name} could not be loaded: ${errorMessage(error)}`)
    }
  }
}
