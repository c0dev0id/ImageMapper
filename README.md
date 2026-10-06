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
2. **Add images** (JPEG, PNG, WebP). Each image becomes a layer, listed with a preview.
   Click an entry to make it the active layer, the one you work on. Drag an entry by its
   handle to change the order (or press the arrow keys on the handle); the eye hides a
   layer, × deletes it. The opacity slider below the list belongs to the active layer.
3. The **toolbar** at the bottom of the map holds the tools of the active image; each
   explains itself in a tooltip.
   - **Pin on map** and **Pin on image** mark point pairs: pin a feature on the image and
     the same feature on the map, or the other way round. The pins take turns on their
     own: after a pin the other side is picked, and the side waiting for its partner is
     greyed out. Esc or the picked tool again stops pinning. Right-click (or long-press
     on a touch screen) offers the same as a menu.
   - **Move, rotate, resize** lines the image up by hand: drag the image to move it, a
     corner to resize it and the round handle to rotate it. Optional, but pinning is
     easier when the image is roughly in place.
   - **Skew image to map** (three or more pairs) fits the image to its pairs. Three pairs
     rotate, scale and skew it; more pairs also bend it so that every pair matches
     exactly. Add pairs where the image is still off and skew again.
   - **Fly to image** and **Move image here** bring an image that is far off into view:
     the view goes to the image, or the image comes to the middle of the view at the
     size of a newly added image.

   Pins and placement always apply to the active layer, also where other images lie on
   top of it. Lowering the opacity or hiding the layer helps to find a feature on the map.
4. **Draw route** switches the toolbar to the route tools: **Append points** (tap the
   map to add points at the end), **Insert point** (tap the route line to add a point
   there), **Add waypoint** and **Delete** (tap a route point or waypoint). Drag points
   to move them. Esc goes back to appending, a second Esc or Done finishes. Each route
   is routed for car, bike or foot. In a route's row, the pencil renames the route, the
   crosshair flies to it and **Edit** continues drawing it.
5. **Waypoints** are places of their own, independent of the routes: a viewpoint, a café,
   a warning about the road. Each has a name and an optional description and is always
   shown on the map. While a route is being drawn, waypoints can be dragged, edited
   (right-click or long-press) or deleted.
6. **Export GPX** writes all routes into one file, one track per route, and all
   waypoints as GPX waypoints with their descriptions.

Image and map points of a pair are shown as a numbered ring (image) and dot (map),
joined by a dashed line until a skew makes them coincide. Drag a point to correct it: a
dot moves on the map, a ring moves to another spot of the image (dropped beside the
image, it goes back). Where a pair coincides, the centre grabs the dot and the ring's
edge grabs the ring. Skew again to apply the change. Right-clicking a point offers to
remove it; removing one side of a pair selects the other side so it can be matched
again.

**Undo** and **Redo** (the arrows in the toolbar, or Ctrl+Z and Ctrl+Shift+Z) step
through the edits of the current session: images, placements, points, skews, routes,
waypoints and names. The map view, the satellite layer and layer visibility and opacity
are not part of it, and opening a file, starting a new project or reloading starts a
new history.

On a phone the panel sits below the map; the arrow at the top of the panel folds it
away to give the map more room.

## Saving

The pencil next to the project name at the top of the panel renames the project; the
name is used for the saved file and the GPX export. The project is kept in the browser's
IndexedDB and restored on the next visit. Clearing the browser's site data removes it,
and Safari may delete it after seven days without a visit. **Save** downloads the whole
project, images included, as a `.mappic` file (a plain ZIP archive with `project.json`
and the original images); **Open** loads such a file again. Projects in the format of
earlier versions (format 1, before waypoints became places of their own) cannot be
opened: there are no migrations before version 1.0.

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
