import type { BlendMode } from '../state/schema.ts'

/** The blend modes offered for image layers, with what each does and is good for (the text of its help). */
export const BLEND_MODES: readonly { value: BlendMode; label: string; description: string }[] = [
  {
    value: 'normal',
    label: 'Normal',
    description:
      'The image covers the map below it. Use it to read the image itself; to compare it with the map, lower the ' +
      'opacity or switch to Multiply, which lets the map show between the printed lines.',
  },
  {
    value: 'multiply',
    label: 'Multiply',
    description:
      'White paper becomes transparent and the printed lines stay, so the map shows between them: the usual mode ' +
      'for scans and photos of printed maps. On a colourful base map a printed route can get lost; a grey base map ' +
      '(Colour, in the Base map section) or Vivid colours bring it back.',
  },
  {
    value: 'darken',
    label: 'Darken',
    description:
      'Each point shows the darker of image and map. Paper disappears as with Multiply, but colours mix less: ' +
      'a red route stays red over a light green forest instead of turning brown.',
  },
  {
    value: 'screen',
    label: 'Screen',
    description:
      'The reverse of Multiply: dark areas of the image become transparent, light lines and text stay. ' +
      'Meant for images with a dark background, such as a screenshot of a navigation app in night mode.',
  },
  {
    value: 'overlay',
    label: 'Overlay',
    description:
      'Mixes both and keeps the light and dark areas of the map. Over a light base map the image fades to a faint ' +
      'tint; over darker ground, such as the satellite layer, its colours show clearly while the map stays readable.',
  },
  {
    value: 'soft-light',
    label: 'Soft light',
    description:
      'A gentler Overlay: the image only tints the map. On a light base map it almost disappears; over the ' +
      'satellite layer or a darker map it marks the printed lines without covering anything.',
  },
  {
    value: 'hard-light',
    label: 'Hard light',
    description:
      'Mixes both and keeps the light and dark areas of the image: its lines stay strong, while its paper ' +
      'brightens the map to a faint trace. The counterpart of Overlay, for when the image matters more than the map.',
  },
  {
    value: 'difference',
    label: 'Difference',
    description:
      'Shows how image and map differ: where they agree, the result turns dark; where the image is off, its lines ' +
      'appear beside those of the map. Use it after a skew to find the places that need another point pair.',
  },
]
