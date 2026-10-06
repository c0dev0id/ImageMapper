# mappic

Transfer a tour printed in a magazine onto a real map and take it along as GPX.

Printed tour maps are simplified, stretched to fit the page and often photographed at
an angle. mappic overlays photos or scans of such maps on OpenStreetMap, warps them into
place using point pairs you mark on the image and on the map (georeferencing with a thin
plate spline), and lets you trace the route on top with OSRM routing.

It runs entirely in the browser; nothing is uploaded anywhere.

## Workflow

1. Move the map to the area of the tour: search for a place or address at the top of the
   panel, or use the locate button below the zoom buttons.
2. **Add images** (JPEG, PNG, WebP). Each image becomes a layer. Layers can be reordered,
   hidden and made transparent. The active layer is the one you are working on: marking
   points and moving always apply to its image, also where other images lie on top of it.
   **Move, rotate, resize** in the active layer's row lines the image up with the map by
   hand: drag the image to move it, a corner to resize it and the round handle to rotate
   it. Optional, but matching points is easier when the image is roughly in place.
   If an image ends up far from where you work, the crosshair button in its row offers
   **Fly to image** (the view goes to the image) and **Move image here** (the image comes
   to the middle of the view, at the size of a newly added image).
3. Right-click (or long-press on a touch screen) a feature on the image and choose
   **Mark point on image**, then do the same on the feature on the map and choose
   **Match point on map** (or the other way round). Points are marked in turns: while a
   point waits for its partner, the menu only offers to match it on the other side.
   Lowering the layer opacity or hiding the layer helps to find the feature on the map.
4. With three or more pairs, press **Skew image to map**. Three pairs rotate, scale and
   skew the image; more pairs also bend it so that every pair matches exactly. Add pairs
   where the image is still off and skew again.
5. **Draw route**: click or tap to add route points, drag them to move, press Esc or Done
   to finish. Each route is routed for car, bike or foot. Right-click or long-press a
   point to remove it or to **change it to a waypoint**: a named place such as a pass or
   a café, asked for when you choose it. The same menu on a waypoint renames it or
   changes it back. Waypoints stay part of the route and keep their name label on the
   map after drawing.
6. **Export GPX** writes all routes into one file, one track per route, with the
   waypoints of all routes as GPX waypoints.

Image and map points of a pair are shown as a numbered ring (image) and dot (map),
joined by a dashed line until a skew makes them coincide. Right-clicking a point offers
to remove it; removing one side of a pair selects the other side so it can be matched
again.

**Undo** and **Redo** (the arrows next to the title, or Ctrl+Z and Ctrl+Shift+Z) step
through the edits of the current session: images, placements, points, skews, routes and
names. The map view, the satellite layer and layer visibility and opacity are not part
of it, and opening a file, starting a new project or reloading starts a new history.

On a phone the panel sits below the map; the arrow next to undo and redo folds it away
to give the map more room.

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
- **Search**: [Nominatim](https://operations.osmfoundation.org/policies/nominatim/), searched
  only when you press Enter (no search-as-you-type), at most one request per second,
  repeated searches answered from a cache.
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
