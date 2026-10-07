import type { ImageColors } from '../state/schema.ts'

/** The ways to show an image's own colours, before it is blended with the map. */
export const IMAGE_COLORS: readonly { value: ImageColors; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'vivid', label: 'Vivid' },
  { value: 'tinted', label: 'One colour' },
]
