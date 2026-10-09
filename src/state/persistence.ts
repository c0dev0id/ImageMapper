import { createStore, del, get, keys, set } from 'idb-keyval'
import { replaceImageBytes } from './images.ts'
import { project, replaceProject, serializeProject, setChangeListener } from './project.ts'
import { parseProject, type Project } from './schema.ts'
import { errorMessage, notify } from './ui.ts'

const db = createStore('image-mapper', 'data')
const PROJECT_KEY = 'project'
const imageKey = (id: string) => `image:${id}`

/** Autosave stays off until the stored project was loaded, so a failed load never overwrites it. */
let enabled = false
let dirty = false
let timer: ReturnType<typeof setTimeout> | undefined
/** Images written in this session; never garbage collected before the next start. */
const writtenThisSession = new Set<string>()

function scheduleSave(): void {
  dirty = true
  if (!enabled) return
  clearTimeout(timer)
  timer = setTimeout(() => void flush(), 400)
}

/** Writes pending project changes to IndexedDB. */
export async function flush(): Promise<void> {
  clearTimeout(timer)
  if (!enabled || !dirty) return
  dirty = false
  try {
    await set(PROJECT_KEY, serializeProject(), db)
  } catch (error) {
    dirty = true
    notify(`Saving to browser storage failed: ${errorMessage(error)}`)
  }
}

/** Loads the stored project (if any) and then enables autosave. */
export async function initPersistence(): Promise<void> {
  setChangeListener(scheduleSave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })

  let json: unknown
  try {
    json = await get(PROJECT_KEY, db)
  } catch (error) {
    notify(`Browser storage is not available, work will not be kept: ${errorMessage(error)}`)
    return
  }
  if (typeof json === 'string') {
    try {
      await restore(json)
    } catch (error) {
      notify(`The project stored in this browser could not be loaded: ${errorMessage(error)}`, {
        label: 'Discard stored project',
        run: discardStoredProject,
        confirm: 'Discard the project stored in this browser? This cannot be undone.',
      })
      return
    }
  }
  enabled = true
  await flush()
  await collectImageGarbage()
}

async function restore(json: string): Promise<void> {
  const stored = parseProject(json)
  const images = new Map<string, ArrayBuffer>()
  for (const layer of stored.layers) {
    const bytes = await get<ArrayBuffer>(imageKey(layer.id), db)
    if (bytes instanceof ArrayBuffer) images.set(layer.id, bytes)
  }
  const missing = stored.layers.length - images.size
  stored.layers = stored.layers.filter((l) => images.has(l.id))
  if (stored.activeLayerId && !images.has(stored.activeLayerId)) {
    stored.activeLayerId = stored.layers.at(-1)?.id
  }
  replaceImageBytes(images)
  replaceProject(stored)
  if (missing > 0) {
    notify(`${missing} image(s) were missing from browser storage and were removed from the project.`)
  }
}

async function discardStoredProject(): Promise<void> {
  await del(PROJECT_KEY, db)
  enabled = true
  scheduleSave()
  await flush()
  await collectImageGarbage()
}

/**
 * Replaces the current project (open a file, new project). Images are written first, so
 * an interruption at any point leaves either the old or the new project complete.
 */
export async function adoptProject(next: Project, images: Map<string, ArrayBuffer>): Promise<void> {
  try {
    for (const [id, bytes] of images) await storeImage(id, bytes)
  } catch (error) {
    notify(`The images could not be stored in the browser and will be lost on reload: ${errorMessage(error)}`)
  }
  replaceImageBytes(images)
  replaceProject(next)
  await flush()
  await collectImageGarbage()
}

/** Stores the original bytes of an image layer. Call before adding the layer. */
export async function storeImage(id: string, bytes: ArrayBuffer): Promise<void> {
  writtenThisSession.add(id)
  await set(imageKey(id), bytes, db)
}

/** Deletes stored images that the current project no longer references. */
export async function collectImageGarbage(): Promise<void> {
  if (!enabled) return
  const referenced = new Set(project.layers.map((l) => l.id))
  for (const key of await keys(db)) {
    if (typeof key !== 'string' || !key.startsWith('image:')) continue
    const id = key.slice('image:'.length)
    if (!referenced.has(id) && !writtenThisSession.has(id)) await del(key, db)
  }
}

let persistRequested = false

/** Asks the browser not to evict our storage under pressure (Firefox shows a prompt). */
export function requestPersistentStorage(): void {
  if (persistRequested) return
  persistRequested = true
  void navigator.storage?.persist?.().catch(() => {})
}
