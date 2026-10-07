import type { ImageColors } from '../state/schema.ts'

/** The ways to show an image's own colours, before it is blended with the map, with what each does (shown in its help). */
export const IMAGE_COLORS: readonly { value: ImageColors; label: string; description: string }[] = [
  {
    value: 'original',
    label: 'Original',
    description:
      'The image keeps the colours it was printed with. Vivid makes them stronger; One colour shows all printed lines and text in a colour you pick.',
  },
  {
    value: 'vivid',
    label: 'Vivid',
    description: 'Stronger colours, so that a printed route stays the route on a busy map.',
  },
  {
    value: 'tinted',
    label: 'One colour',
    description:
      'All printed lines and text in one colour, picked with the swatch, the paper staying white. Against a grey base map (Colour in the Base map section) the image then stands out at a glance.',
  },
]
