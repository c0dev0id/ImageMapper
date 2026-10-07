import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl'
import type { Warp } from '../geo/warp.ts'
import type { BlendMode } from '../state/schema.ts'
import { Backdrop, linkProgram } from './gl.ts'

const VERTEX_SHADER = `#version 300 es
uniform mat4 u_matrix;
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`

// Blend modes after the W3C Compositing and Blending spec, with b the backdrop (what lies
// below) and s the image colour. Mode 0 (normal) relies on MapLibre's blending; the other
// modes read the backdrop from a copy of the framebuffer and write the final colour.
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform sampler2D u_backdrop;
uniform float u_opacity;
uniform int u_mode;
in vec2 v_uv;
out vec4 color;

vec3 screen(vec3 b, vec3 s) { return b + s - b * s; }
vec3 hardLight(vec3 b, vec3 s) { return mix(b * 2.0 * s, screen(b, 2.0 * s - 1.0), step(0.5, s)); }
vec3 softLight(vec3 b, vec3 s) {
  vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
}

void main() {
  // The texture is premultiplied, matching MapLibre's ONE, ONE_MINUS_SRC_ALPHA blending.
  vec4 src = texture(u_texture, v_uv);
  if (u_mode == 0) {
    color = src * u_opacity;
    return;
  }
  vec3 b = texelFetch(u_backdrop, ivec2(gl_FragCoord.xy), 0).rgb;
  vec3 s = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
  vec3 mixed;
  if (u_mode == 1) mixed = b * s;
  else if (u_mode == 2) mixed = min(b, s);
  else if (u_mode == 3) mixed = screen(b, s);
  else if (u_mode == 4) mixed = hardLight(s, b);
  else if (u_mode == 5) mixed = softLight(b, s);
  else if (u_mode == 6) mixed = hardLight(b, s);
  else mixed = abs(b - s);
  color = vec4(mix(b, mixed, src.a * u_opacity), 1.0);
}`

/** Shader numbers of the blend modes; overlay is hard light with image and backdrop swapped. */
const MODE_NUMBERS: Record<BlendMode, number> = {
  normal: 0,
  multiply: 1,
  darken: 2,
  screen: 3,
  overlay: 4,
  'soft-light': 5,
  'hard-light': 6,
  difference: 7,
}

/** Longest texture side: about 350 dpi for an A4 page while bounding GPU memory per layer. */
const MAX_TEXTURE_SIDE = 4096

interface GlResources {
  program: WebGLProgram
  matrix: WebGLUniformLocation | null
  texture: WebGLUniformLocation | null
  backdrop: WebGLUniformLocation | null
  opacity: WebGLUniformLocation | null
  mode: WebGLUniformLocation | null
  vao: WebGLVertexArrayObject
  positions: WebGLBuffer
  uvs: WebGLBuffer
  indices: WebGLBuffer
}

/**
 * Draws an image warped by a {@link Warp} mesh as a MapLibre custom layer.
 *
 * All GL calls happen inside `render()`: MapLibre caches GL bindings and only resyncs
 * them around custom layer rendering, so uploads from elsewhere would corrupt its state.
 * Setters only store data and request a repaint.
 */
export class WarpedImageLayer implements CustomLayerInterface {
  readonly type = 'custom'
  readonly renderingMode = '2d'

  private map?: MapLibreMap
  private gl?: GlResources
  private texture?: WebGLTexture
  private pendingBitmap?: ImageBitmap
  private decoding = false
  private maxTextureSide = MAX_TEXTURE_SIDE
  private warp?: Warp
  private meshDirty = false
  private indexCount = 0
  private indexType = 0
  /** Mercator origin the vertex positions are relative to (avoids float32 jitter at high zoom). */
  private origin: [number, number] = [0, 0]
  private opacity = 1
  private blend: BlendMode = 'normal'
  /** Copy of what was drawn below this layer, for blend modes other than normal. */
  private readonly backdrop = new Backdrop()

  constructor(
    readonly id: string,
    private readonly loadImage: () => Promise<Blob>,
  ) {}

  setWarp(warp: Warp): void {
    this.warp = warp
    this.meshDirty = true
    this.map?.triggerRepaint()
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity
    this.map?.triggerRepaint()
  }

  setBlend(blend: BlendMode): void {
    this.blend = blend
    this.map?.triggerRepaint()
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    this.map = map
    // A read-only query does not disturb MapLibre's cached bindings.
    this.maxTextureSide = Math.min(MAX_TEXTURE_SIDE, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number)
    map.on('webglcontextlost', this.onContextLost)
    map.on('webglcontextrestored', this.onContextRestored)
    void this.decode()
  }

  onRemove(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    map.off('webglcontextlost', this.onContextLost)
    map.off('webglcontextrestored', this.onContextRestored)
    if (this.gl) {
      gl.deleteProgram(this.gl.program)
      gl.deleteVertexArray(this.gl.vao)
      gl.deleteBuffer(this.gl.positions)
      gl.deleteBuffer(this.gl.uvs)
      gl.deleteBuffer(this.gl.indices)
    }
    if (this.texture) gl.deleteTexture(this.texture)
    this.backdrop.delete(gl)
    this.pendingBitmap?.close()
    this.gl = undefined
    this.texture = undefined
    this.pendingBitmap = undefined
    this.map = undefined
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    this.gl ??= createResources(gl)
    if (this.pendingBitmap) this.uploadTexture(gl, this.pendingBitmap)
    if (this.meshDirty && this.warp) this.uploadMesh(gl, this.warp)
    if (!this.texture || this.indexCount === 0 || this.opacity <= 0) return

    // mainMatrix maps 0..1 Mercator to clip space; append the translation to our origin in
    // double precision, then hand float32 to the GPU.
    const m = options.defaultProjectionData.mainMatrix
    const [ox, oy] = this.origin
    const matrix = new Float32Array(16)
    for (let i = 0; i < 12; i++) matrix[i] = m[i]
    for (let r = 0; r < 4; r++) matrix[12 + r] = m[r] * ox + m[4 + r] * oy + m[12 + r]

    const res = this.gl
    const mode = MODE_NUMBERS[this.blend]
    if (mode !== 0) {
      this.backdrop.copy(gl, 1)
      // The shader writes the blended colour itself; MapLibre restores its state afterwards.
      gl.disable(gl.BLEND)
    }
    gl.useProgram(res.program)
    gl.uniformMatrix4fv(res.matrix, false, matrix)
    gl.uniform1f(res.opacity, this.opacity)
    gl.uniform1i(res.mode, mode)
    gl.uniform1i(res.texture, 0)
    gl.uniform1i(res.backdrop, 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.bindVertexArray(res.vao)
    gl.drawElements(gl.TRIANGLES, this.indexCount, this.indexType, 0)
    gl.bindVertexArray(null)
  }

  private async decode(): Promise<void> {
    if (this.decoding || this.texture || this.pendingBitmap) return
    this.decoding = true
    try {
      const blob = await this.loadImage()
      const full = await createImageBitmap(blob, {
        imageOrientation: 'from-image',
        premultiplyAlpha: 'premultiply',
      })
      const scale = Math.min(1, this.maxTextureSide / Math.max(full.width, full.height))
      let bitmap = full
      if (scale < 1) {
        // Resize the already oriented bitmap, so EXIF rotation and resizing cannot mix up axes.
        bitmap = await createImageBitmap(full, {
          resizeWidth: Math.round(full.width * scale),
          resizeHeight: Math.round(full.height * scale),
          resizeQuality: 'high',
          premultiplyAlpha: 'premultiply',
        })
        full.close()
      }
      if (this.map) {
        this.pendingBitmap = bitmap
        this.map.triggerRepaint()
      } else bitmap.close()
    } catch (error) {
      console.error(`Image layer ${this.id}: decoding failed`, error)
    } finally {
      this.decoding = false
    }
  }

  private uploadTexture(gl: WebGL2RenderingContext, bitmap: ImageBitmap): void {
    this.texture ??= gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic')
    if (anisotropy) {
      const max = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number
      gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max))
    }
    bitmap.close()
    this.pendingBitmap = undefined
  }

  private uploadMesh(gl: WebGL2RenderingContext, warp: Warp): void {
    const res = this.gl!
    this.origin = warp.center
    const [ox, oy] = this.origin
    const relative = new Float32Array(warp.positions.length)
    for (let i = 0; i < relative.length; i += 2) {
      relative[i] = warp.positions[i] - ox
      relative[i + 1] = warp.positions[i + 1] - oy
    }
    gl.bindVertexArray(res.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, res.positions)
    gl.bufferData(gl.ARRAY_BUFFER, relative, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, res.uvs)
    gl.bufferData(gl.ARRAY_BUFFER, warp.uvs, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, res.indices)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, warp.indices, gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    this.indexCount = warp.indices.length
    this.indexType = warp.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
    this.meshDirty = false
  }

  /** GL objects are invalid after a context loss; recreate them lazily and decode again. */
  private readonly onContextLost = () => {
    this.gl = undefined
    this.texture = undefined
    this.backdrop.forget()
    this.indexCount = 0
  }

  private readonly onContextRestored = () => {
    this.meshDirty = true
    void this.decode()
  }
}

function createResources(gl: WebGL2RenderingContext): GlResources {
  const program = linkProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER, 'image')
  const vao = gl.createVertexArray()
  const positions = gl.createBuffer()
  const uvs = gl.createBuffer()
  const indices = gl.createBuffer()
  gl.bindVertexArray(vao)
  const posLocation = gl.getAttribLocation(program, 'a_pos')
  gl.bindBuffer(gl.ARRAY_BUFFER, positions)
  gl.enableVertexAttribArray(posLocation)
  gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0)
  const uvLocation = gl.getAttribLocation(program, 'a_uv')
  gl.bindBuffer(gl.ARRAY_BUFFER, uvs)
  gl.enableVertexAttribArray(uvLocation)
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
  gl.bindVertexArray(null)
  return {
    program,
    matrix: gl.getUniformLocation(program, 'u_matrix'),
    texture: gl.getUniformLocation(program, 'u_texture'),
    backdrop: gl.getUniformLocation(program, 'u_backdrop'),
    opacity: gl.getUniformLocation(program, 'u_opacity'),
    mode: gl.getUniformLocation(program, 'u_mode'),
    vao,
    positions,
    uvs,
    indices,
  }
}
