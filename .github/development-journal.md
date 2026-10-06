# Development journal

## Overview and intent

Magazines print tour maps that are geometrically wrong: simplified, skewed to fit
the page, and often photographed at an angle. mappic transfers such a route to a
real map:

1. Load photos or scans of the printed map as image layers on top of OSM.
2. Georeference each image with ground control points (GCPs): pairs of the same
   feature marked on the image and on the map.
3. Warp the image so every pair matches (rubber sheeting with a thin plate spline).
4. Trace the tour on top with OSRM routing, filling gaps between partial images, and
   mark places worth knowing as waypoints.
5. Export all routes as one GPX file with one track per route, plus the waypoints.

It is a static single-page app hosted on GitHub Pages. Work is kept in the browser
(IndexedDB) and can be saved to / opened from a project file.

## Software stack

- SolidJS 1.9 (UI and state), Vite 8 (build), TypeScript 7 (type checking).
- MapLibre GL JS 6 (map rendering, WebGL2 required).
- fflate (ZIP project files), idb-keyval (IndexedDB access).
- tesseract.js 7 with its WebAssembly engine and the German model (text recognition for
  matching towns), loaded on first use.
- Vitest 5 for unit tests of the pure modules.
- Icons from Tabler Icons (MIT), copied as SVG paths into `src/ui/icons.tsx` rather than
  added as a dependency; the licence text is in `src/ui/tabler-icons-license.txt`.
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
- **GCP model.** A GCP has an optional image side and an optional map side. Selection is
  one side of one GCP of the active layer. "Match" sets or replaces the opposite side of
  the selected GCP; "remove" removes one side and selects the remaining one. Sides are
  marked in turns: with a side selected, neither the menu nor the pin tools offer a new
  point on that side, so a half-marked GCP cannot be left behind by accident; after each
  pin the toolbar picks the other side's pin. Esc or a click on the empty map deselects
  on purpose; the click that only closes an open menu does not. Both markers can be
  dragged to correct a point. A map dot keeps the dropped position; an image ring takes
  the pixel under the drop through the drawn mesh (the same inverse as a click) and goes
  back when dropped beside the image. The warp itself only changes on the next skew.
  Dots are stacked above rings so both sides of a nested pair stay reachable. Draggable
  markers do not pass right-clicks and long presses to the map, so they open their menu
  themselves (`onMarkerMenu`, shared with route points).
- **Routing.** Each leg (pair of consecutive route points) is requested separately from
  the FOSSGIS OSRM server for the route's profile (car, bike, foot). Results are
  cached in the route under a key built from profile and both coordinates and stored
  as polyline6 strings. A pull-based pump fetches missing legs one at a time with at
  least 1.1 s between requests (FOSSGIS allows one request per second). Legs are
  persisted so reloading never re-routes on newer OSM data.
- **Waypoints are places of their own** (GPX `wpt`), independent of the routes: name
  and optional description, stored in the project's `waypoints`. Route points are only
  route points (`points`); an earlier version named route points instead, which mixed
  routing with places of interest. Changing this made project format 2; format 1 is not
  read (no migrations before 1.0). Waypoints are created with the waypoint tool, edited
  in a native `<dialog>` and can be dragged, edited or deleted while a route is drawn;
  otherwise their markers take no pointer events. Labels are DOM markers rather than a
  symbol layer, because the inline map style has no glyph source for text.
- **Toolbar and tools.** A toolbar over the map carries the tools of the current scope:
  the active image (Pin Map, Pin Image, Skew Image | Center on Image, Move Image Here,
  Resize) or the route being drawn (Append, Insert, Waypoint, Delete), with undo and redo
  always. Each group is a box of its own; the boxes wrap onto a second row on narrow
  screens instead of scrolling, so no tool is out of sight. Every tool has a one-line
  caption (its accessible name) and a longer tooltip. Icons of related tools are variants
  of one icon: the same pin badge on a map or on a picture, the same arrow into or out of
  a picture. The picked tool is a UI signal next to the mode; map taps are dispatched on
  it, and it is set as `data-tool` on the map element so CSS can change the cursor. The
  context menus stay as a second way to the same actions. Inserting finds the leg
  nearest to the tap in screen pixels (routed geometry, or the straight line while
  unrouted) and puts the new point on the line, so the route keeps its shape.
- **State updates.** All writes go through actions; results of pure functions are
  applied with `reconcile` at the narrowest path. Components that own MapLibre
  objects are keyed by id so edits never recreate map layers.
- **Undo.** Snapshots of the project are taken before every content edit (images, GCPs,
  skews, routes, waypoints, names) and restored with `reconcile`. Display settings (map
  view, satellite, layer visibility, opacity and blend mode) keep their current values
  on undo, so toggling an image while looking for map features does not fill the
  history. Routing results are not steps. Open/New/reload start a new history. Every deletion is
  an undo step and is not confirmed; what cannot be undone asks first: New and Open
  while the project holds layers, routes or waypoints, and discarding a stored project
  that cannot be read (a notice action can carry such a question).
- **Touch.** MapLibre fires `contextmenu` for a 500 ms touch on the map; the app drops the
  click that may follow the lifting finger, and a long-press menu only reacts to a new
  tap. Draggable markers block MapLibre's long press, so they detect their own with
  pointer events (touch and pen only).
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
- **Blend modes in the shader.** The image layers draw into MapLibre's canvas, so CSS
  blend modes do not apply, and fixed-function GL blending cannot do overlay, soft
  light, hard light or difference (they need the colour below). For any mode but normal
  the layer copies the framebuffer into an RGB texture (`copyTexSubImage2D`; MapLibre's
  canvas is not multisampled) and the fragment shader mixes image and backdrop with the
  W3C Compositing and Blending formulas, writing the result with blending off. One copy
  per frame and blended layer; normal keeps the plain premultiplied path. The mode is a
  display setting like opacity: stored per layer (absent means normal), not undone.
- **Layer list.** Entries show a preview, made once per layer as a small bitmap
  (`createImageBitmap` with a resize) rather than an `<img>` of the full photo. They are
  reordered by dragging a handle with pointer events (HTML drag and drop barely works
  on touch screens); a copy follows the pointer and a line marks the drop place. The
  handle also takes the arrow keys. One opacity slider and the blend mode below the list
  act on the active layer.
- **Names are text, not fields.** Route and project names show as text with a pencil
  button; renaming swaps in a focused field in place (Enter or leaving it keeps the
  name, Esc or an empty field drops the change). The panel shows no open text fields
  apart from the search box.
- **Bringing things into view** lives in `map/navigate.ts`: one `showBounds` (padding,
  current rotation kept) behind place search, fly to image and fly to route; move image
  here is there too. Fly to
  route fits the joined route geometry, so routed detours stay in view.
- **The active layer is the target.** Every image interaction (marking points, moving,
  resizing, rotating) applies to the active layer's image, also where other images are
  drawn over it. Hit tests run against the active image's warp or footprint only, never
  against the rendered stack, so overlapping images cannot intercept or block a gesture.
  The dashed frame, handles and point markers are drawn above all images. Hiding a layer
  only stops drawing it: it stays active, keeps its point markers, links and the picked
  tool, and can still be moved by hand, so a pair can be pinned on the image and then on
  the map below it. A new image point needs the image shown, because the user cannot see
  what they would pin; the hint bar says so.
- **Phones.** Below 720 px the panel moves under the map (at most 45 % of the height)
  and can be folded to its title row. Coarse pointers get larger buttons, markers and
  handles, and 16 px inputs so iOS does not zoom in on focus. The toolbar sits higher
  on narrow screens, above the attribution, which starts expanded over two lines, and
  uses smaller captions so that it needs at most two rows.
- **Placing an image by town names.** The user names up to four towns printed on the
  image. Text recognition reads the image (Tesseract's German LSTM model in sparse-text
  mode, as map labels are scattered; small images are enlarged twice, since labels are
  often only ten pixels high), and the names are matched against the words read with an
  edit-distance tolerance that grows with the name's length. Nominatim settlement
  searches give the map candidates, up to five per name; a name no settlement has (a
  pass, a peak) is searched again without that filter, and the agreement with the other
  towns decides. A town can also be picked by hand, on either side: a place on the map
  (a search under the row, started with the name, any kind of place) or the spot on the
  image (a tap; an empty row takes the name read there, joined across the words of one
  printed line). A tap on a row that has a name takes the spot as tapped, centred on the
  label only if the image was read already, so it never waits for text recognition. A
  picked side is the only candidate of its row; with every row picked on the image, the
  image is not read at all. Picks settle namesakes, names the lookup
  cannot find and labels the text recognition misses, while the name stays as printed.
  The tap goes through a general tap request: the next map tap goes to the requester,
  also where a marker sits (markers take no pointer events meanwhile), with a hint and a
  crosshair. Esc, Cancel, a mode change, a tool pick or another request end it; the
  requester may refuse a tap (beside the image, or with the image hidden) and keep
  waiting. The dialog does not block the map, so the image
  can be panned, zoomed and tapped while it is open; it is dragged by its title, stays
  partly on screen and keeps its position, and it stays open after a match that left
  towns out, saying per row what is missing. Its lookups prefer the area that was in view
  when it opened, so a retry after the view moved asks the same questions and the search
  answers them from its cache. Reading and looking up run side by side; when one fails,
  the other is stopped. The country of the picked places does not
  choose the text recognition model: a map is printed in the magazine's language (a
  German map of Italy says "Mailand"), and the German model with accent-free comparison
  reads Latin script well enough. Each pair of towns and candidates proposes a
  similarity transform; towns within 10 % of the image diagonal count, the best proposal
  is refitted by least squares, and ties go to upright maps and better-ranked
  candidates. The fit is a similarity rather than the thin plate spline because text
  recognition finds the label, which sits beside the town; exact interpolation would
  bend the image toward the labels. The towns become ordinary point pairs for the user
  to correct before skewing, in one undo step with the new placement. Each carries the
  name of its town (`Gcp.town`), and the next match replaces all such pairs, edited or
  not, while pairs pinned by hand stay: a corrected namesake or a dragged ring cannot
  leave a stale pair or a second one for the same town. The marker is project data, not
  session memory, so undo, reloads and project files keep it consistent. Words read are
  kept per layer for the session. The image goes to the worker as PNG, encoded while
  the worker loads: JPEG was smaller and faster to decode but lost a printed name on the
  Allgäu sample. The engine, worker and model (about 5 MB) are files of
  the build, loaded on first use; tesseract.js 7 cannot take the model as bytes (its
  init passes the data where the language code belongs), so the model keeps its file
  name in the build and the worker fetches it from that directory. Its promises stay
  pending when the worker fails, so failures are routed through its error handler.
  Everything lives in `src/match/`, its styles included, so the feature can be taken out
  in one piece.
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
- **Licence notices in a file.** Minification drops licence comments, so the bundle
  itself carries no notices. Vite's `build.license` writes `licenses.txt` with the
  licences of all bundled packages; a small plugin in `vite.config.ts` appends the Tabler
  Icons licence, which Vite cannot see because the icon shapes are copied into the
  source. The file sits next to `index.html` (Vite's default `.vite/` folder would be a
  hidden directory) and is linked in the footer; it only exists in builds, not on the
  development server.

## Core features

- OSM base map, Esri satellite layer with visibility and opacity.
- Place/address search (Nominatim) and locate-me.
- Image layers (JPEG, PNG, WebP; EXIF orientation honoured) with previews, drag
  reordering, visibility, opacity, blend modes and an active layer.
- A map toolbar with captioned tools of the active image or the route being drawn.
- GCP editing with pin tools or context menus (right-click or long press), and "skew
  image to map" with fold/mirror checks.
- A first placement from up to four town names, read on the image and looked up on the
  map, or picked by hand on either side.
- Move, rotate and resize an image by hand on the map; fly to an image or bring it
  into the view.
- Undo/redo of content edits.
- Draw route mode: append, insert, drag and delete route points; per-route OSRM
  profile; fly to a route.
- Waypoints with name and description, independent of the routes.
- GPX export of all routes as tracks, with all waypoints.
- Project save/open/new; automatic persistence in IndexedDB including map view.
- Layout for phones and touch screens.
