# Image Mapper

Take a tour printed in a magazine and carry it along as GPX. Image Mapper overlays a
photo or scan of a printed tour map on a web map, warps it into place, and lets you
trace the route and export it. It runs entirely in the browser; nothing is uploaded.

## Features

- **Georeferencing** — mark point pairs on the image and the map; a thin plate spline warps the image into place.
- **Match Towns** — a rough first placement from a few named towns, before any pairs are set.
- **Blend and recolour** — Multiply, Difference and recolouring read the map through the image and show misalignment.
- **Route tracing** — trace routes with OSRM for car, bike or foot, with straight-line legs where routing has no data.
- **Waypoints** — named places with optional descriptions, independent of the routes.
- **GPX export** — all routes (one track each) and all waypoints in one file.
- **Many base maps** — raster and vector world maps, official regional maps, and an optional satellite overlay.
- **Local only** — stored in the browser's IndexedDB; save and reopen the whole project as a single `.imgmap` file.
- **Undo/redo, dark mode, phone layout** — session history, a light/dark toggle that follows the browser, and a foldaway panel.

## Getting started

Open the app in a browser. There is nothing to install or sign up for.

1. **Move the map** to the area of the tour — search for a place, or use the locate button.
2. **Add an image** (JPEG, PNG, WebP). Each image is a layer you can show, reorder and recolour.
3. **Place it** — Match Towns for a first guess, then mark point pairs with Pin and press Skew Image.
4. **Draw route** — append points along roads or as straight lines; insert, move and delete points.
5. **Add waypoints** for viewpoints, cafés or warnings.
6. **Export GPX** to carry the result on a GPS device or phone.

The first visit explains the app; the (i) by the name shows it again, and the (?) marks explain blend modes, colours and placement with pictures.

## Keyboard and pointer

| Input | Action |
| --- | --- |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo the current session |
| Esc | Step back, then cancel the current tool |
| Right-click / long-press | Start a point pair, or edit a waypoint |
| Drag | Move the map, a point, or the active image while resizing |

## Services

Image Mapper calls these public services directly from the browser. Please respect their terms.

| Service | Used for | Terms |
| --- | --- | --- |
| [OSM, OpenTopoMap, CyclOSM, OpenFreeMap, VersaTiles](https://openfreemap.org/) and regional agencies | Base maps | Each map's own licence and attribution, shown on the map |
| Esri World Imagery | Satellite overlay | Keyless legacy endpoint; Esri's terms apply |
| [Nominatim](https://operations.osmfoundation.org/policies/nominatim/) | Place search | One request per second, on Enter only |
| [FOSSGIS OSRM](https://routing.openstreetmap.de/about.html) | Routing | One request per 1.1 s; operator contact shown in the panel |

Every endpoint lives in `src/config.ts`. Credits sit at the bottom right of the map
and fold into their (i) after a few seconds, as the OSMF attribution guidelines allow.

## Development

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev        # development server
npm test           # unit tests (Vitest)
npm run e2e        # end-to-end tests of the built app (Playwright, Chromium)
npm run typecheck  # TypeScript
npm run build      # production build in dist/
```

The end-to-end tests build the app on port 4173 and mock every external request, so
they run offline. Run `npx playwright install chromium` once before the first run.

Stack: SolidJS, MapLibre GL JS 6, Vite, TypeScript, fflate, idb-keyval. Icons are drawn
from [Tabler Icons](https://tabler.io/icons) (MIT). The build writes `licenses.txt`
next to the app. Design rationale is in
[.github/development-journal.md](.github/development-journal.md).

## Deployment

`.github/workflows/deploy.yml` type-checks, tests and builds on every push and pull
request, then deploys pushes to `main` to GitHub Pages. One-time setup: make `main` the
default branch and set **Settings → Pages → Source** to **GitHub Actions**. The build
uses relative paths, so it works under any sub-path.
</content>
</invoke>
