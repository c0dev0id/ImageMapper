import { nextRouteColor } from '../routing/routeEdit.ts'
import type { BlendMode, ImageColors } from '../state/schema.ts'
import {
  Banner,
  Dot,
  GpxBadge,
  Link,
  MapDrawing,
  Panel,
  PhotoDrawing,
  placement,
  PrintDrawing,
  RouteDrawing,
  Ring,
  SheetDrawing,
  Then,
  TOWN_POINTS,
} from './drawings.tsx'
import type { Help } from './help.ts'
import { tinted, vivid } from './paint.ts'

/** The printed map over the map in a blend mode, placed by `transform`. */
function Blended(props: { mode: BlendMode; transform?: string }) {
  return (
    <>
      <MapDrawing />
      <g style={{ 'mix-blend-mode': props.mode }} transform={props.transform}>
        <PrintDrawing />
      </g>
    </>
  )
}

/** The image as a sheet over part of the map in a blend mode, drawn by the browser's own mix-blend-mode. */
function SheetOnMap(props: { mode: BlendMode }) {
  return (
    <>
      <MapDrawing />
      <g style={{ 'mix-blend-mode': props.mode }}>
        <SheetDrawing edge={props.mode === 'normal'} />
      </g>
    </>
  )
}

/**
 * What blend modes are for, shown by the most common case: a sheet with white paper hides
 * the map, Multiply lets the map through. The browser's mix-blend-mode follows the same W3C
 * formulas as the image shader. The modes without a clear use share one entry.
 */
export const BLEND_HELP: Help = {
  title: 'Blend modes',
  steps: [
    {
      banner: () => (
        <Banner>
          <Panel caption="Normal">
            <SheetOnMap mode="normal" />
          </Panel>
          <Then />
          <Panel caption="Multiply">
            <SheetOnMap mode="multiply" />
          </Panel>
        </Banner>
      ),
      text:
        'A blend mode sets how the image combines with the map below it, so that the printed route and the ' +
        'details of the map show together.',
      options: [
        { name: 'Normal', text: 'the image as it is. It hides the map unless its opacity is lowered.' },
        {
          name: 'Multiply',
          text:
            'for an image whose white background hides the map. The white disappears, the printed lines ' +
            'stay; the usual choice for scans and photos.',
        },
        { name: 'Darken', text: 'like Multiply, for when printed colours turn muddy over coloured areas of the map.' },
        { name: 'Screen', text: 'the reverse of Multiply, for an image with a dark background.' },
        { name: 'Difference', text: 'to check a skew. Lines that show twice mark where the image is still off.' },
        {
          name: 'Overlay, Soft light, Hard light',
          text:
            'no fixed use. Try them together with Colours and Opacity until the printed route and the map ' +
            'details both show well.',
        },
      ],
    },
  ],
}

/** What the colour options are for: all three side by side, One colour in the layer's colour. */
export function colorsHelp(tint: string): Help {
  const paints: Record<ImageColors, ((hex: string) => string) | undefined> = {
    original: undefined,
    vivid,
    tinted: (hex) => tinted(hex, tint),
  }
  return {
    title: 'Colours',
    steps: [
      {
        banner: () => (
          <Banner>
            <Panel caption="Original">
              <PrintDrawing paint={paints.original} />
            </Panel>
            <Panel caption="Vivid">
              <PrintDrawing paint={paints.vivid} />
            </Panel>
            <Panel caption="One colour">
              <PrintDrawing paint={paints.tinted} />
            </Panel>
          </Banner>
        ),
        text:
          'Colours change only the image, before it is blended with the map, so that the printed route stands ' +
          'out from the map.',
        options: [
          { name: 'Original', text: 'the colours as printed or photographed.' },
          { name: 'Vivid', text: 'for faded colours, as in a photo or an old print; their saturation is doubled.' },
          {
            name: 'One colour',
            text:
              'for the strongest contrast. All lines and text take the colour of the swatch, while paper and ' +
              'pale areas turn white; best over a grey base map (Colour, in the Base map section).',
          },
        ],
      },
    ],
  }
}

/** Where Match Towns puts an image: close, but a little turned, enlarged and shifted. */
const ROUGH = placement(-6, 1.08, [4, -3])

/** How an image gets into place: Match Towns first, then point pairs and a skew. */
export const MATCH_TOWNS_HELP: Help = {
  title: 'Placing an image',
  steps: [
    {
      title: 'Match towns',
      banner: () => (
        <Banner>
          <Panel caption="Towns on the image">
            <PrintDrawing />
            {TOWN_POINTS.slice(0, 3).map((p) => (
              <Ring at={p} />
            ))}
          </Panel>
          <Then />
          <Panel caption="A first placement">
            <Blended mode="multiply" transform={ROUGH.transform} />
          </Panel>
        </Banner>
      ),
      text:
        "Type a town's name, press Enter and pick the place from the results, then tap the town on the image with " +
        "the row's image pin. Two towns are enough; with three or more, far apart, a wrong pick is found and left " +
        'out. Towns are too rough to skew by, so the match keeps no point pairs.',
    },
    {
      title: 'Pin and skew',
      banner: () => (
        <Banner>
          <Panel caption="Pairs where it is off">
            <Blended mode="multiply" transform={ROUGH.transform} />
            {TOWN_POINTS.map((p) => (
              <Link from={ROUGH.apply(p)} to={p} />
            ))}
            {TOWN_POINTS.map((p) => (
              <Ring at={ROUGH.apply(p)} />
            ))}
            {TOWN_POINTS.map((p) => (
              <Dot at={p} />
            ))}
          </Panel>
          <Then />
          <Panel caption="Skewed to fit">
            <Blended mode="multiply" />
            {TOWN_POINTS.map((p) => (
              <Ring at={p} />
            ))}
            {TOWN_POINTS.map((p) => (
              <Dot at={p} />
            ))}
          </Panel>
        </Banner>
      ),
      text:
        'Pin adds point pairs, always image first: tap a spot on the image (ring), then the same place on the map ' +
        '(dot). Skew Image fits the image to its pairs: three turn, scale and slant it; more also bend it until ' +
        'every pair matches. Where it is still off, add pairs or drag a ring or dot, then skew again.',
    },
  ],
}

/** What mappic is for: shown on the first visit, and from the (i) beside the title. */
export const ABOUT_HELP: Help = {
  title: 'About mappic',
  steps: [
    {
      banner: () => (
        <Banner>
          <Panel caption="Add an image">
            <PhotoDrawing />
          </Panel>
          <Then />
          <Panel caption="Pin and skew">
            <Blended mode="multiply" />
            {TOWN_POINTS.map((p) => (
              <Ring at={p} />
            ))}
            {TOWN_POINTS.map((p) => (
              <Dot at={p} />
            ))}
          </Panel>
          <Then />
          <Panel caption="Draw the route">
            <MapDrawing />
            <RouteDrawing color={nextRouteColor([])} />
            <GpxBadge />
          </Panel>
        </Banner>
      ),
      text:
        'mappic turns a tour printed in a magazine, or a photo of one, into a GPX track for a navigation device or ' +
        'app. Printed maps are simplified and stretched, so the image is first fitted onto the real map with pairs ' +
        'of points that mark the same place on both. The route traced over it then follows the roads. Images and ' +
        'projects stay in this browser.',
    },
  ],
}
