# Development journal

## Overview and intent

Magazines print tour maps that are geometrically wrong: simplified, skewed to fit
the page, and often photographed at an angle. mappic transfers such a route to a
real map:

1. Load photos or scans of the printed map as image layers on top of OSM.
2. Georeference each image with ground control points (GCPs): pairs of the same
   feature marked on the image and on the map.
3. Warp the image so every pair matches (rubber sheeting with a thin plate spline).
4. Trace the tour on top with OSRM routing, filling gaps between partial images.
5. Export all routes as one GPX file with one track per route.

It is a static single-page app hosted on GitHub Pages. Work is kept in the browser
(IndexedDB) and can be saved to / opened from a project file.

## Software stack

- SolidJS 1.9 (UI and state), Vite 8 (build), TypeScript 7 (type checking).
- MapLibre GL JS 6 (map rendering, WebGL2 required).
- fflate (ZIP project files), idb-keyval (IndexedDB access).
- Vitest 5 for unit tests of the pure modules.
- External services: OSM standard tiles, Esri World Imagery tiles, FOSSGIS OSRM
  routing servers (routing.openstreetmap.de), Nominatim search.
- Deployment: GitHub Actions to GitHub Pages.

## Key decisions

- **Thin plate spline, own implementation.** TPS interpolates every GCP exactly; with
  three pairs it is the affine transform. It is fitted in Web Mercator (the display
  space) rather than in raw longitude/latitude. The solver is a small Gaussian
  elimination; inputs are validated (duplicates, collinear points) before solving.
  @allmaps/transform was evaluated and rejected: beta API churn, extra dependencies,
  no degeneracy checks.
- **Own MapLibre custom layer for warped images.** MapLibre's image source only
  supports a 4-corner (projective) warp, which cannot represent a TPS. Allmaps'
  WarpedMapLayer only loads IIIF images and does not support pitch. The custom layer
  draws a triangulated grid whose vertices are pushed through the TPS; the map's own
  projection matrix keeps it locked to the ground under zoom, rotation and pitch.
  Vertex positions are stored relative to a per-layer origin and the matrix is
  composed in double precision to avoid float32 jitter at high zoom. All GL calls
  happen inside `render()` so MapLibre's cached GL state stays valid.
- **Inverse mapping through the drawn mesh.** A click is converted to image pixels by
  finding the mesh triangle under it, so the result is exactly the pixel on screen.
- **GCP model.** A GCP has an optional image side and an optional map side. Selection
  is one side of one GCP of the active layer. "Match" sets or replaces the opposite
  side of the selected GCP; "remove" removes one side and selects the remaining one.
  Sides are marked in turns: with a side selected, the menu offers no new point, so a
  half-marked GCP cannot be left behind by accident. Esc or a click on the empty map
  deselects on purpose; the click that only closes an open menu does not.
- **Routing.** Each leg (pair of consecutive waypoints) is requested separately from
  the FOSSGIS OSRM server for the route's profile (car, bike, foot). Results are
  cached in the route under a key built from profile and both coordinates and stored
  as polyline6 strings. A pull-based pump fetches missing legs one at a time with at
  least 1.1 s between requests (FOSSGIS allows one request per second). Legs are
  persisted so reloading never re-routes on newer OSM data.
- **Waypoints.** A waypoint is a route point with a name; the route still runs through
  it. The name is optional on the stored point (whose list keeps OSRM's name,
  `waypoints`, so existing projects load unchanged). Naming does not touch the routed
  legs. The export writes named points as GPX `wpt` elements before the tracks. The name
  is asked for with the browser's prompt, like the confirmations for New and Open.
  Labels are DOM markers rather than a symbol layer, because the inline map style has no
  glyph source for text; outside draw mode they take no pointer events.
- **State updates.** All writes go through actions; results of pure functions are
  applied with `reconcile` at the narrowest path. Components that own MapLibre
  objects are keyed by id so edits never recreate map layers.
- **Undo.** Snapshots of the project are taken before every content edit (images, GCPs,
  skews, routes, names) and restored with `reconcile`. Display settings (map view,
  satellite, layer visibility and opacity) keep their current values on undo, so toggling
  an image while looking for map features does not fill the history. Routing results are
  not steps. Open/New/reload start a new history; deletions need no confirmation.
- **Touch.** MapLibre fires `contextmenu` for a 500 ms touch on the map; the app drops the
  click that may follow the lifting finger, and a long-press menu only reacts to a new
  tap. Draggable waypoint markers block MapLibre's long press, so they detect their own
  with pointer events (touch and pen only).
- **Placing an image by hand.** Move, rotate and resize change the map side of the
  placement pairs by a similarity transform in Web Mercator. The TPS is linear in its
  targets, so the warped image, bends included, moves as a whole and the GCPs stay as
  they are; a later skew starts again from the GCPs. Rotation and scaling pivot on the
  image centre and scaling is uniform, because stretching is what GCPs are for. Each
  gesture records one undo step when it starts. A press on the image arrives as a
  MapLibre layer event on a transparent fill of the image's footprint; preventing it
  keeps the map's pan, pinch and long press out of that gesture, and a second finger
  hands the gesture back to the map. "Move image here" applies the same kind of
  transform to fit an image that is far off into the view (centred, sized like a new
  image); "Fly to image" fits the view to the image instead.
- **Panel menus are popovers.** The image layer menu uses the HTML Popover API: it lies
  in the top layer, so the scrolling panel cannot clip it, and closes on outside clicks
  and Esc by itself. It is placed next to its button by script (above it when the
  button is in the lower half of the screen, as in the phone layout).
- **The active layer is the target.** Every image interaction (marking points, moving,
  resizing, rotating) applies to the active layer's image, also where other images are
  drawn over it. Hit tests run against the active image's warp or footprint only, never
  against the rendered stack, so overlapping images cannot intercept or block a gesture.
  The dashed frame, handles and point markers are drawn above all images.
- **Phones.** Below 720 px the panel moves under the map (at most 45 % of the height)
  and can be folded to its title row. Coarse pointers get larger buttons, markers and
  handles, and 16 px inputs so iOS does not zoom in on focus.
- **Finding the area.** Locating uses MapLibre's GeolocateControl (one shot, no tracking).
  Search uses Nominatim on explicit submit only, since its policy forbids
  search-as-you-type; requests are spaced one second apart, identical requests cached,
  and the visible area is passed as a preference once zoomed in (zoom >= 6).
- **Persistence.** The project is stored as JSON in IndexedDB, image bytes as
  ArrayBuffers (Safari private mode rejects Blobs). Autosave is enabled only after the
  stored project loaded successfully, so a failed load never overwrites data.
- **Image storage clean-up.** Image bytes in IndexedDB are only deleted at start-up and
  after Open/New, and never ones written in the current session, so a clean-up cannot
  race with an image that is still being added.
- **Rendering limits.** Textures are capped at 4096 px on the long side (about 350 dpi
  for an A4 page) to bound GPU memory. `renderWorldCopies` is off because the custom
  layer draws a single world copy; markers and lines would otherwise repeat.
- **Project file.** A `.mappic` file is a plain ZIP with `project.json` and the
  original image bytes. Opening validates the whole file before anything is replaced.
- **No migrations before 1.0.** Project files and stored data carry a version number;
  unknown versions are rejected.
- **Third-party terms.** OSM tile usage policy (attribution, no offline caching),
  FOSSGIS terms (one request per second, attribution, operator contact shown in the
  app). Esri World Imagery is used through the keyless legacy URL; Esri's terms only
  cover use with Esri software or an ArcGIS subscription. The URL is a single
  constant in `src/config.ts`.

## Core features

- OSM base map, Esri satellite layer with visibility and opacity.
- Place/address search (Nominatim) and locate-me.
- Image layers (JPEG, PNG, WebP; EXIF orientation honoured) with order, visibility,
  opacity and an active layer.
- Move, rotate and resize an image by hand on the map; fly to an image or bring it
  into the view.
- Context-menu driven GCP editing (right-click or long press) and "skew image to map"
  with fold/mirror checks.
- Undo/redo of content edits.
- Draw route mode: append, drag and remove route points; per-route OSRM profile.
- Named route points (waypoints), shown on the map.
- GPX export of all routes as tracks, with their waypoints.
- Project save/open/new; automatic persistence in IndexedDB including map view.
- Layout for phones and touch screens.
