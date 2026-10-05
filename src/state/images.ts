/**
 * Original image bytes per layer id, kept outside the reactive store. Bytes of deleted
 * layers stay for the session, so undoing the deletion can show the image again.
 */
const bytesById = new Map<string, ArrayBuffer>()

export function imageBytes(id: string): ArrayBuffer | undefined {
  return bytesById.get(id)
}

export function addImageBytes(id: string, bytes: ArrayBuffer): void {
  bytesById.set(id, bytes)
}

export function replaceImageBytes(images: Map<string, ArrayBuffer>): void {
  bytesById.clear()
  for (const [id, bytes] of images) bytesById.set(id, bytes)
}

export function allImageBytes(): ReadonlyMap<string, ArrayBuffer> {
  return bytesById
}

export function imageBlob(id: string, mime: string): Blob | undefined {
  const bytes = bytesById.get(id)
  return bytes && new Blob([bytes], { type: mime })
}
