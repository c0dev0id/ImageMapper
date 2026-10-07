import type { BlendMode } from '../state/schema.ts'

/** The blend modes offered for image layers, with what each is good for here (shown in its help). */
export const BLEND_MODES: readonly { value: BlendMode; label: string; description: string }[] = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'The image as it is, covering the map; lower its opacity to see the map through it.',
  },
  {
    value: 'multiply',
    label: 'Multiply',
    description: 'White paper turns transparent, printed lines stay: good for scans and photos of maps.',
  },
  { value: 'darken', label: 'Darken', description: 'Keeps the darker of image and map; like multiply, with cleaner colours.' },
  { value: 'screen', label: 'Screen', description: 'Dark parts turn transparent: for images on a dark background.' },
  { value: 'overlay', label: 'Overlay', description: 'Mixes both, keeping the contrast of the map.' },
  { value: 'soft-light', label: 'Soft light', description: 'The image tints the map gently; both stay readable.' },
  { value: 'hard-light', label: 'Hard light', description: 'Mixes both, keeping the contrast of the image.' },
  {
    value: 'difference',
    label: 'Difference',
    description: 'Where image and map match they cancel out; misaligned lines show twice. Good to check a skew.',
  },
]
