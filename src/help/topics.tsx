import type { BlendMode, ImageColors } from '../state/schema.ts'
import { BLEND_MODES } from '../ui/blendModes.ts'
import { IMAGE_COLORS } from '../ui/imageColors.ts'
import {
  Banner,
  Dot,
  Link,
  MapDrawing,
  Panel,
  placement,
  Plus,
  PrintDrawing,
  Ring,
  Then,
  TOWN_POINTS,
} from './drawings.tsx'
import type { Help } from './help.ts'
import { inverted, tinted, vivid } from './paint.ts'

type Paint = (hex: string) => string

/** The printed map over the map in a blend mode, recoloured by `paint` and placed by `transform`. */
function Blended(props: { mode: BlendMode; paint?: Paint; transform?: string }) {
  return (
    <>
      <MapDrawing />
      <g style={{ 'mix-blend-mode': props.mode }} transform={props.transform}>
        <PrintDrawing paint={props.paint} />
      </g>
    </>
  )
}

/**
 * What a blend mode does: image and map, and the two blended by the browser's own
 * mix-blend-mode, which follows the same W3C formulas as the image shader. Screen is shown
 * with a dark image, which it is for, and Difference with the image a little off, which it
 * finds.
 */
export function blendHelp(mode: BlendMode): Help {
  const { label, description } = BLEND_MODES.find((m) => m.value === mode) ?? BLEND_MODES[0]
  const paint = mode === 'screen' ? inverted : undefined
  const transform = mode === 'difference' ? 'translate(2.5 2)' : undefined
  return {
    title: `Blend mode: ${label}`,
    steps: [
      {
        banner: () => (
          <Banner>
            <Panel caption="Image">
              <PrintDrawing paint={paint} />
            </Panel>
            <Plus />
            <Panel caption="Map">
              <MapDrawing />
            </Panel>
            <Then />
            <Panel caption="Result">
              <Blended mode={mode} paint={paint} transform={transform} />
            </Panel>
          </Banner>
        ),
        text: description,
      },
    ],
  }
}

/** What a colour option does to the image; Original shows all three side by side. */
export function colorsHelp(colors: ImageColors, tint: string): Help {
  const option = (value: ImageColors) => IMAGE_COLORS.find((c) => c.value === value) ?? IMAGE_COLORS[0]
  const paints: Record<ImageColors, Paint | undefined> = {
    original: undefined,
    vivid,
    tinted: (hex) => tinted(hex, tint),
  }
  const picture = (value: ImageColors) => (
    <Panel caption={option(value).label}>
      <PrintDrawing paint={paints[value]} />
    </Panel>
  )
  return {
    title: `Colours: ${option(colors).label}`,
    steps: [
      {
        banner: () =>
          colors === 'original' ? (
            <Banner>
              {picture('original')}
              {picture('vivid')}
              {picture('tinted')}
            </Banner>
          ) : (
            <Banner>
              {picture('original')}
              <Then />
              {picture(colors)}
            </Banner>
          ),
        text: option(colors).description,
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
