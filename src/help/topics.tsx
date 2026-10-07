import type { BlendMode, ImageColors } from '../state/schema.ts'
import { BLEND_MODES } from '../ui/blendModes.ts'
import { IMAGE_COLORS } from '../ui/imageColors.ts'
import { Banner, MapDrawing, Panel, Plus, PrintDrawing, Then } from './drawings.tsx'
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
            <Panel caption={label}>
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
