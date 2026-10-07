import type { ImageColors } from '../state/schema.ts'

/** The ways to show an image's own colours before it is blended with the map, with what each does (the text of its help). */
export const IMAGE_COLORS: readonly { value: ImageColors; label: string; description: string }[] = [
  {
    value: 'original',
    label: 'Original',
    description:
      'The image keeps the colours it was printed or photographed with. The other options change only the image, ' +
      'not the map, and work with every blend mode: Vivid strengthens faded colours, One colour turns all lines ' +
      'and text into a colour you pick.',
  },
  {
    value: 'vivid',
    label: 'Vivid',
    description:
      'Doubles the saturation of the image, so that the faded colours of a photo or an old print become strong ' +
      'again. A printed route then stays distinct on a colourful base map, also with Multiply.',
  },
  {
    value: 'tinted',
    label: 'One colour',
    description:
      'All lines and text of the image take the colour of the swatch beside the option, while paper and pale ' +
      'areas such as forests turn white. Over a grey base map (Colour, in the Base map section) the image then ' +
      'stands out at a glance.',
  },
]
