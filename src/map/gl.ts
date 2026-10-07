/** WebGL helpers shared by the app's custom MapLibre layers. */

/** Compiles and links a program; `name` says which one when that fails. */
export function linkProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  name: string,
): WebGLProgram {
  const program = gl.createProgram()
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource, name)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, name)
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  // Flagged for deletion; they go away together with the program.
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Linking the ${name} shader failed: ${gl.getProgramInfoLog(program)}`)
  }
  return program
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string, name: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Compiling the ${name} shader failed: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

/**
 * A copy of the framebuffer, that is of everything drawn below the layer taking it. RGB is
 * a subset of any framebuffer format, so the copy is always allowed; MapLibre's canvas is
 * not multisampled, which a copy would not allow.
 */
export class Backdrop {
  private texture?: WebGLTexture
  private size: [number, number] = [0, 0]

  /** Copies the framebuffer and leaves the copy bound to texture unit `unit`. */
  copy(gl: WebGL2RenderingContext, unit: number): void {
    const width = gl.drawingBufferWidth
    const height = gl.drawingBufferHeight
    gl.activeTexture(gl.TEXTURE0 + unit)
    if (!this.texture || this.size[0] !== width || this.size[1] !== height) {
      this.texture ??= gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      this.size = [width, height]
    } else gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height)
  }

  delete(gl: WebGL2RenderingContext): void {
    if (this.texture) gl.deleteTexture(this.texture)
    this.forget()
  }

  /** After a context loss the texture is gone; the next copy makes a new one. */
  forget(): void {
    this.texture = undefined
    this.size = [0, 0]
  }
}
