import { imageBlob } from '../state/images.ts'

/** Height of the previews in pixels: twice their CSS height, for sharp screens. */
const HEIGHT = 64

const urls = new Map<string, Promise<string | undefined>>()

/**
 * A small preview of a layer's image as an object URL, made once per layer, so the list
 * never holds full-size decoded photos.
 */
export function thumbnailUrl(id: string, mime: string): Promise<string | undefined> {
  let url = urls.get(id)
  if (!url) {
    url = makeThumbnail(id, mime)
    urls.set(id, url)
  }
  return url
}

async function makeThumbnail(id: string, mime: string): Promise<string | undefined> {
  const blob = imageBlob(id, mime)
  if (!blob) return undefined
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: 'from-image',
    resizeHeight: HEIGHT,
    resizeQuality: 'medium',
  })
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  const preview = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  return preview ? URL.createObjectURL(preview) : undefined
}
