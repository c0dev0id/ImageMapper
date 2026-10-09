import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { parseProject, type Project } from './schema.ts'

/**
 * A project file is a plain ZIP archive: `project.json` plus the original bytes of every
 * image as `images/<layer id>`.
 */
export function encodeProjectFile(
  project: Project,
  images: ReadonlyMap<string, ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  const files: Zippable = { 'project.json': [strToU8(JSON.stringify(project, null, 2)), { level: 6 }] }
  for (const layer of project.layers) {
    const bytes = images.get(layer.id)
    if (!bytes) throw new Error(`The image of layer "${layer.name}" is missing.`)
    // Photos are already compressed; store them as they are.
    files[`images/${layer.id}`] = [new Uint8Array(bytes), { level: 0 }]
  }
  return zipSync(files)
}

/** Reads and fully validates a project file before anything is replaced. */
export function decodeProjectFile(data: Uint8Array): { project: Project; images: Map<string, ArrayBuffer> } {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    throw new Error('This is not an Image Mapper project file.')
  }
  const json = files['project.json']
  if (!json) throw new Error('This is not an Image Mapper project file: project.json is missing.')
  const project = parseProject(strFromU8(json))
  const images = new Map<string, ArrayBuffer>()
  for (const layer of project.layers) {
    const bytes = files[`images/${layer.id}`]
    if (!bytes) throw new Error(`The image of layer "${layer.name}" is missing from the file.`)
    images.set(layer.id, bytes.slice().buffer)
  }
  return { project, images }
}
