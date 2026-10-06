import germanUrl from '@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz?url'
import coreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import simdCoreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
import type { TextWord } from './names.ts'

/**
 * Map labels are often only about ten pixels high: smaller images are enlarged before
 * reading, very large photos reduced to bound the work.
 */
const ENLARGE_BELOW = 1600
const LONGEST_SIDE = 3200

/** WebAssembly SIMD support, tested with a minimal module (as wasm-feature-detect does). */
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
])

export type ReadStage = 'loading' | 'reading'

/** Words read so far per layer, for this session: a second try with other names is instant. */
const wordsByLayer = new Map<string, TextWord[]>()

/** The words of a layer's image, if they were read already in this session. */
export function knownWords(layerId: string): TextWord[] | undefined {
  return wordsByLayer.get(layerId)
}

/**
 * Reads the words printed on a layer's image with Tesseract (German model, sparse text,
 * since map labels are scattered rather than set in lines). Engine, worker and model
 * are files of the build, fetched only here; positions are in the image's own pixels.
 */
export async function readWords(
  layerId: string,
  image: Blob,
  onProgress: (stage: ReadStage, share?: number) => void,
  signal: AbortSignal,
): Promise<TextWord[]> {
  const known = wordsByLayer.get(layerId)
  if (known) return known
  onProgress('loading')
  const { createWorker, OEM, PSM } = await abortable(import('tesseract.js'), signal)
  // Tesseract.js leaves its promises pending when the worker fails (a model that does not
  // load, for one); its error handler is told, and turns that into an error here.
  let fail: (reason: Error) => void = () => undefined
  const failed = new Promise<never>((_, reject) => {
    fail = reject
  })
  // A failure after the work is done (while terminating, say) has nobody waiting for it.
  failed.catch(() => undefined)
  const until = <T>(promise: Promise<T>) => abortable(Promise.race([promise, failed]), signal)
  const starting = createWorker('deu', OEM.LSTM_ONLY, {
    workerPath: absolute(workerUrl),
    corePath: absolute(WebAssembly.validate(SIMD_PROBE) ? simdCoreUrl : coreUrl),
    langPath: new URL('.', absolute(germanUrl)).href,
    // The browser caches the model file like any other; no second copy in IndexedDB.
    cacheMethod: 'none',
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress('reading', message.progress)
    },
    errorHandler: (error) => fail(new Error(`Text recognition failed: ${String(error)}`)),
  })
  try {
    // The worker loads while the image is prepared.
    const [worker, page] = await until(Promise.all([starting, prepareForReading(image)]))
    // Tesseract's notes ("Estimating resolution as …") would otherwise land in the console as errors.
    await until(worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, debug_file: '/dev/null' }))
    const { data } = await until(worker.recognize(page.image, {}, { blocks: true }))
    const { scale } = page
    const words: TextWord[] = []
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const { text, bbox } of line.words) {
            words.push({ text, box: [bbox.x0 / scale, bbox.y0 / scale, bbox.x1 / scale, bbox.y1 / scale] })
          }
        }
      }
    }
    wordsByLayer.set(layerId, words)
    return words
  } finally {
    // Also when cancelled while the worker was still starting.
    void starting.then(
      (worker) => worker.terminate(),
      () => undefined,
    )
  }
}

/**
 * The image upright (EXIF orientation applied, as everywhere in the app) at the size to
 * read it at, encoded for the worker. PNG, not JPEG: compression artefacts cost names in
 * small print (Bezau on the Allgäu sample).
 */
async function prepareForReading(image: Blob): Promise<{ image: Blob; scale: number }> {
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' })
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = longest < ENLARGE_BELOW ? 2 : Math.min(1, LONGEST_SIDE / longest)
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot prepare the image for reading.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return { image: await canvas.convertToBlob({ type: 'image/png' }), scale }
}

/** The worker loads its scripts from a blob URL, so every path it gets must be absolute. */
function absolute(url: string): string {
  return new URL(url, document.baseURI).href
}

/** Settles like the promise, or rejects as soon as the signal aborts. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}
