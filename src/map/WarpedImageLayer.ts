import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl'
import type { Warp } from '../geo/warp.ts'

const VERTEX_SHADER = `#version 300 es
uniform mat4 u_matrix;
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform float u_opacity;
in vec2 v_uv;
out vec4 color;
void main() {
  // The texture is premultiplied, matching MapLibre's ONE, ONE_MINUS_SRC_ALPHA blending.
  color = texture(u_texture, v_uv) * u_opacity;
}`

/** Longest texture side: about 350 dpi for an A4 page while bounding GPU memory per layer. */
const MAX_TEXTURE_SIDE = 4096

interface GlResources {
  program: WebGLProgram
  matrix: WebGLUniformLocation | null
  texture: WebGLUniformLocation | null
  opacity: WebGLUniformLocation | null
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
    gl.useProgram(res.program)
    gl.uniformMatrix4fv(res.matrix, false, matrix)
    gl.uniform1f(res.opacity, this.opacity)
    gl.uniform1i(res.texture, 0)
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
    this.indexCount = 0
  }

  private readonly onContextRestored = () => {
    this.meshDirty = true
    void this.decode()
  }
}

function createResources(gl: WebGL2RenderingContext): GlResources {
  const program = gl.createProgram()
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  // Flagged for deletion; they go away together with the program.
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Linking the image shader failed: ${gl.getProgramInfoLog(program)}`)
  }
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
    opacity: gl.getUniformLocation(program, 'u_opacity'),
    vao,
    positions,
    uvs,
    indices,
  }
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Compiling the image shader failed: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}
