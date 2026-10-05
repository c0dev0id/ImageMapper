# mappic

Transfer a tour printed in a magazine onto a real map and take it along as GPX.

Printed tour maps are simplified, stretched to fit the page and often photographed at
an angle. mappic overlays photos or scans of such maps on OpenStreetMap, warps them into
place using point pairs you mark on the image and on the map (georeferencing with a thin
plate spline), and lets you trace the route on top with OSRM routing.

It runs entirely in the browser; nothing is uploaded anywhere.

## Workflow

1. Move the map to the area of the tour.
2. **Add images** (JPEG, PNG, WebP). Each image becomes a layer; the active layer is the
   one you are working on. Layers can be reordered, hidden and made transparent.
3. Right-click a feature on the image and choose **Mark point on image**, then right-click
   the same feature on the map and choose **Match point on map** (or the other way round).
   Lowering the layer opacity or hiding the layer helps to find the feature on the map.
4. With three or more pairs, press **Skew image to map**. Three pairs rotate, scale and
   skew the image; more pairs also bend it so that every pair matches exactly. Add pairs
   where the image is still off and skew again.
5. **Draw route**: click to add waypoints, drag them to move, right-click one to remove it,
   press Esc or Done to finish. Each route is routed for car, bike or foot.
6. **Export GPX** writes all routes into one file, one track per route.

Image and map points of a pair are shown as a numbered ring (image) and dot (map),
joined by a dashed line until a skew makes them coincide. Right-clicking a point offers
to remove it; removing one side of a pair selects the other side so it can be matched
again.

## Saving

The project is kept in the browser's IndexedDB and restored on the next visit. Clearing
the browser's site data removes it, and Safari may delete it after seven days without a
visit. **Save** downloads the whole project, images included, as a `.mappic` file (a
plain ZIP archive with `project.json` and the original images); **Open** loads such a
file again.

## Services

mappic uses public services directly from the browser. Please respect their terms:

- **Map tiles**: [OpenStreetMap tile servers](https://operations.osmfoundation.org/policies/tiles/),
  © OpenStreetMap contributors.
- **Satellite imagery**: Esri World Imagery via its keyless legacy endpoint. Esri's terms
  only cover this together with Esri software or an ArcGIS subscription; the URL is a
  single constant in `src/config.ts`.
- **Routing**: [FOSSGIS OSRM servers](https://routing.openstreetmap.de/about.html) (car, bike,
  foot). At most one request per second; mappic waits 1.1 s between requests. The terms
  require the operator's contact address to be shown, which the app does in its panel.

## Development

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev        # development server
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript
npm run build      # production build in dist/
npm run preview    # serve dist/
```

Stack: SolidJS, MapLibre GL JS 6, Vite, TypeScript, fflate, idb-keyval. Design notes are
in [.github/development-journal.md](.github/development-journal.md).

## Deployment

`.github/workflows/deploy.yml` type-checks, tests and builds every push and pull request,
and deploys pushes to `main` to GitHub Pages. One-time setup: make `main` the default
branch, then set **Settings → Pages → Build and deployment → Source** to
**GitHub Actions**. The build uses relative paths, so it works under any sub-path.
