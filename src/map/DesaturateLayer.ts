import type { CustomLayerInterface, Map as MapLibreMap } from 'maplibre-gl'
import { Backdrop, linkProgram } from './gl.ts'

// One triangle that covers the screen, made from the vertex number alone.
const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_backdrop;
uniform float u_saturation;
out vec4 color;
void main() {
  vec3 b = texelFetch(u_backdrop, ivec2(gl_FragCoord.xy), 0).rgb;
  float luma = dot(b, vec3(0.2126, 0.7152, 0.0722));
  color = vec4(mix(vec3(luma), b, u_saturation), 1.0);
}`

/**
 * Takes the colour out of everything drawn below it, the base map and the satellite, so
 * that the images above stand out; at full saturation it draws nothing. MapLibre has no
 * such setting for vector styles, whose colours are spread over hundreds of layers.
 */
export class DesaturateLayer implements CustomLayerInterface {
  readonly type = 'custom'
  readonly renderingMode = '2d'

  private map?: MapLibreMap
  private program?: WebGLProgram
  private uniforms?: { backdrop: WebGLUniformLocation | null; saturation: WebGLUniformLocation | null }
  private readonly backdrop = new Backdrop()
  private saturation = 1

  constructor(readonly id: string) {}

  /** From 0, grey, to 1, the colours as they are. */
  setSaturation(saturation: number): void {
    this.saturation = saturation
    this.map?.triggerRepaint()
  }

  onAdd(map: MapLibreMap): void {
    this.map = map
    map.on('webglcontextlost', this.onContextLost)
  }

  onRemove(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    map.off('webglcontextlost', this.onContextLost)
    if (this.program) gl.deleteProgram(this.program)
    this.backdrop.delete(gl)
    this.program = undefined
    this.map = undefined
  }

  render(gl: WebGL2RenderingContext): void {
    if (this.saturation >= 1) return
    if (!this.program) {
      this.program = linkProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER, 'base map colour')
      this.uniforms = {
        backdrop: gl.getUniformLocation(this.program, 'u_backdrop'),
        saturation: gl.getUniformLocation(this.program, 'u_saturation'),
      }
    }
    this.backdrop.copy(gl, 0)
    // The screen is replaced by its own grey copy; MapLibre restores its state afterwards.
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.useProgram(this.program)
    gl.uniform1i(this.uniforms!.backdrop, 0)
    gl.uniform1f(this.uniforms!.saturation, this.saturation)
    gl.bindVertexArray(null)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** GL objects are invalid after a context loss; the next render makes new ones. */
  private readonly onContextLost = () => {
    this.program = undefined
    this.backdrop.forget()
  }
}
