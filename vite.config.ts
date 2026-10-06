/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import solid from 'vite-plugin-solid'

/** The licences of everything the app ships, served next to it and linked in its footer. */
const LICENSES = 'licenses.txt'

/**
 * Adds the Tabler Icons licence to the licences file. The icon shapes are copied into
 * src/ui/icons.tsx rather than bundled from a package, so Vite does not list them.
 */
function iconLicense(): Plugin {
  let root = ''
  return {
    name: 'mappic:icon-license',
    configResolved(config) {
      root = config.root
    },
    generateBundle: {
      // After vite:license has emitted the file.
      order: 'post',
      async handler(_, bundle) {
        const text = await this.fs.readFile(`${root}/src/ui/tabler-icons-license.txt`, { encoding: 'utf8' })
        const file = bundle[LICENSES]
        if (file?.type !== 'asset' || typeof file.source !== 'string') {
          this.error(`${LICENSES} was not emitted; is build.license set?`)
        }
        file.source += `\n## Tabler Icons (MIT), shapes in src/ui/icons.tsx\n\n${text.trim()}\n`
      },
    },
  }
}

export default defineConfig({
  // Relative base: the build works under any path (e.g. https://<user>.github.io/mappic/).
  base: './',
  plugins: [solid(), iconLicense()],
  build: {
    // MapLibre alone is about 1 MB minified and is needed on first paint.
    chunkSizeWarningLimit: 1500,
    // Minification drops licence comments, so the notices go into a file of their own.
    license: { fileName: LICENSES },
    rolldownOptions: {
      output: {
        // Tesseract fetches its model by file name from a directory, so the model keeps its name.
        assetFileNames: ({ names }) =>
          names.some((name) => name.endsWith('.traineddata.gz')) ? 'assets/[name][extname]' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    // vite-plugin-solid switches tests to jsdom unless an environment is set.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
