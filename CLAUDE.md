# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Image Mapper is a static, browser-only single-page app: it overlays photos of printed tour
maps on a web map, warps them into place with a thin plate spline fitted to point pairs
(GCPs), traces routes with OSRM and exports GPX. No backend; deployed to GitHub Pages.

`.github/development-journal.md` holds the design rationale for nearly every non-obvious
choice (why a custom GL layer, why tap delays, why no migrations, which services were
rejected). Read the relevant entry before changing behaviour, and add or update an entry
when a decision changes. `README.md` describes the user-facing behaviour in detail and is
kept in sync with it.

## Commands

Node.js 22.12 or newer.

```sh
npm ci
npm run dev                        # Vite dev server
npm test                           # Vitest, all unit tests (src/**/*.test.ts, node env)
npx vitest run src/geo/tps.test.ts # one test file
npx vitest run -t "name"           # tests matching a name
npm run typecheck                  # tsc for src/ and for e2e/ (separate tsconfig)
npm run build                      # production build into dist/, plus dist/licenses.txt
npm run e2e                        # Playwright against the built app on port 4173
npx playwright test e2e/route.spec.ts  # one e2e spec
```

CI (`.github/workflows/deploy.yml`) runs typecheck, unit tests, build and e2e on every
push; pushes to `main` deploy to Pages.

E2E notes: the Playwright `webServer` builds and previews the app itself (reuses a server
already on 4173 outside CI). Chromium runs WebGL on SwiftShader. `e2e/app.ts` mocks every
external request (tiles, vector styles, OSRM, Nominatim), so tests run offline; new specs
must go through its helpers rather than hit real services. Tests wait for expected
outcomes, not fixed timeouts (autosave debounces 400 ms, map taps are delayed 150 ms).
Projects are seeded via `emptyProject()` so schema changes surface as type errors. No
retries are configured, on purpose.

## Architecture

SolidJS + MapLibre GL JS 6 + TypeScript, built with Vite. Imports use explicit `.ts`/`.tsx`
extensions (`allowImportingTsExtensions`, `verbatimModuleSyntax`).

**State (`src/state/`)** — three layers, kept strictly apart:
- `project.ts`: the single Solid store holding the persisted `Project` (shape and
  validation in `schema.ts`). All writes go through the exported actions, which record an
  undo snapshot (`history.ts`) before content edits, notify the autosave listener, and
  apply results of pure functions with `reconcile` at the narrowest path. Display settings
  (view, base map, satellite, layer visibility/opacity/blend/colours) are deliberately not
  undone (`withCurrentDisplay`).
- `ui.ts`: transient signals, never persisted: mode (`georef` | `route` | `transform`),
  picked tool, pending pin, tap requests, notices, menus.
- `derived.ts`: memos keyed by layer id (e.g. the `Warp` per image) so an edit to one layer
  never rebuilds another.
- `persistence.ts`: IndexedDB via idb-keyval (project JSON + image bytes as ArrayBuffers);
  `projectFile.ts`: the `.imgmap` ZIP (fflate) with `project.json` and original images.
  Files and stored data carry a format version; unknown versions are rejected. There are
  no migrations before 1.0.

**Pure logic (unit-tested, no DOM/MapLibre):** `geo/` (Web Mercator, TPS solver, `Warp`
mesh and its inverse, similarity fit, bounds), `gcp/` (skew preparation and
fold/degeneracy checks), `routing/` (route editing, legs, OSRM client with a pull-based
1.1 s rate-limited pump, polyline6), `search/nominatim.ts`, `export/gpx.ts`, `match/`
fitting and reports. Keep new logic in this style so it can be tested in node.

**Map (`src/map/`)** — Solid components rendered inside `MapContext` once the map has
loaded (`App.tsx`); each owns MapLibre sources/layers/markers and is keyed by id so edits
do not recreate map objects. Key pieces:
- `WarpedImageLayer.ts`: custom WebGL layer drawing each image as a TPS-warped triangle
  mesh, with blend modes and recolouring in the fragment shader. All GL calls stay inside
  `render()`. `DesaturateLayer.ts` greys out everything below the images.
- `baseMap.ts` / `BaseLayers.tsx`: swaps base map sources/layers (prefixed `base/`) inside
  the running style; never use `setStyle`, it drops the custom layers. `tileGaps.ts` turns
  transparent tiles into 404s via a `gaps://` protocol.
- `Interactions.tsx` + `tapFilter.ts` + `longPress.ts`: map tap dispatch by mode/tool,
  with the 150 ms tap delay that filters clicks around drags.
- `navigate.ts`: all "bring into view" logic.

**Panel (`src/ui/`)**, **help dialogs with SVG drawings (`src/help/`)**, and **Match Towns
(`src/match/`, self-contained including its CSS)**.

`src/config.ts` holds every external endpoint: `BASE_MAPS` (raster tile URL or vector style
URL, with attribution, bounds and zoom range), the Esri satellite URL, OSRM and Nominatim.
Respect the services' rate limits and attribution requirements described in the README.
The operator contact shown in the panel (required by the FOSSGIS terms) is assembled at
runtime from `CONTACT_PARTS` rather than written out.

Icons are Tabler Icons copied as SVG paths into `src/ui/icons.tsx` (not a dependency); the
Vite plugin in `vite.config.ts` appends their licence to `licenses.txt`.

## Conventions

- Commit messages: imperative sentence subject without type prefixes, a short plain body
  explaining what and why.
- Help texts and README prose follow the style already there: plain, structured, nothing
  the UI already says.
