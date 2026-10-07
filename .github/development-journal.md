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
- Vitest 5 for unit tests of the pure modules.
- Icons from Tabler Icons (MIT), copied as SVG paths into `src/ui/icons.tsx` rather than
  added as a dependency; the licence text is in `src/ui/tabler-icons-license.txt`.
- External services: base maps (OSM standard, OpenTopoMap and BKG TopPlusOpen raster
  tiles; OpenFreeMap and VersaTiles vector tiles with their styles), Esri World Imagery
  tiles, FOSSGIS OSRM routing servers
  (routing.openstreetmap.de), Nominatim search.
- Deployment: GitHub Actions to GitHub Pages.

## Key decisions

- **Base maps.** The panel picks the base map from `BASE_MAPS`: raster entries are a
  tile URL, vector entries a MapLibre style URL. OSM's raster tiles have their labels
  baked in at about 11 px and are upscaled, blurry, on high-density screens; vector
  styles draw labels in CSS pixels at any density, so they are larger and sharp. The
  switch swaps the base map's sources and layers inside the running style (ids prefixed
  `base/`, inserted below the satellite layer) and takes over the style's fonts and
  icons; `setStyle` is no option, because serialising a style drops the custom image
  layers. A style's projection, sky and light are ignored, so the Mercator image layers
  stay right. A raster entry is turned into a one-layer style, so both kinds take the
  same path; it carries the highest zoom its server renders (OpenTopoMap 17,
  TopPlusOpen 18), beyond which MapLibre enlarges the last tiles. Raster maps are not
  all small-print: OpenTopoMap and TopPlusOpen bake in large labels and are offered
  next to the vector maps. A map earns its place by what it shows, not by its colour:
  outdoor detail (tracks, trails, their surface and difficulty) is what the vector maps
  leave out, so CyclOSM was added after a comparison of one trail-dense area, while a
  copy of an existing map in another style (OSM.de) was not. Official topographic maps
  by region come below the maps of the world, grouped in the menu (`region`, an
  `<optgroup>` per run): a few countries and German states, more on request rather than a
  hundred. They must serve Web Mercator with CORS headers, which WebGL needs for the
  tiles: WMTS and XYZ services as templates, WMS as a GetMap request with
  `{bbox-epsg-3857}`, which MapLibre fills in per tile, so no proxy is needed. Each has
  `bounds`, so nothing is fetched beyond its region, and the zooms its server renders
  (the Bavarian WMS draws nothing at small scales, hence `minzoom` 12). Candidates came
  from the WMSproxy library; France's SCAN 25 was left out, as it is refused without a
  key. The pick is a display setting in the project (`baseMap`), like the
  satellite: kept in files, not undone. Liberty is the default, also for projects saved
  before the choice existed: OpenFreeMap needs no key and sets no usage limits.
- **Missing tiles show the zoom below, enlarged.** A raster tile that fails to load (a
  404 where a server has no data at that zoom) is replaced by MapLibre with its parent
  tile, scaled up; only a tile that loads but is empty is drawn as it is. Esri's
  satellite imagery answers missing zooms with a grey "Map data not yet available" tile;
  `blankTile=false` in its URL turns those into 404s.

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
  Where a skew folds the image over itself, several triangles lie under the click; the
  search starts from the one drawn last, which is the one on top and the one seen.
- **GCP model.** A GCP is a complete pair: an image point and its map point, both
  required. Half pairs used to be allowed and are now turned away when a project loads
  (same version, no migration before 1.0): nothing creates them any more, and allowing
  them cost checks in the markers, the menu, the skew and the layer row. New pairs are
  pinned in a strict order, image first, because pinning the two sides in either order
  made it easy to put a map point where an image point was meant. The Pin tool (or the
  menu's "Pin point on image") takes the image point, which waits as a dashed ring
  outside the project (`pendingPin`); the next tap anywhere on the map, through a tap
  request, pins its place and stores the pair in one undo step. Leaving the flow (Esc,
  Cancel, another tool, a mode or layer change) drops the waiting ring, so no half pair
  is left behind. Removing always takes the whole pair, named by its number in the menu.
  There is no selection: selecting one side to match it anew and removing a single side
  went together, since neither was used in practice, dragging already corrects a side,
  and both only served half pairs. Both markers can be
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
  persisted so reloading never re-routes on newer OSM data. A leg can be straight
  instead, for a way the routing does not know: the point it leads to carries
  `straight`, and such a leg is never requested, keeps no cached geometry, is drawn solid
  like a routed leg and exported as its two ends. The flag sits on the point at the end
  of the leg, so a removed point leaves the merged leg the kind of the next one, and a
  point inserted into a leg takes that leg's kind, keeping both halves as they were. The
  toolbar's Route/Line pair (`reach`, not saved) sets it for appended points and starts
  at Route with every drawing.
- **Waypoints are places of their own** (GPX `wpt`), independent of the routes: name
  and optional description, stored in the project's `waypoints`. Route points are only
  route points (`points`); an earlier version named route points instead, which mixed
  routing with places of interest. Changing this made project format 2; format 1 is not
  read (no migrations before 1.0). Waypoints are created with the waypoint tool, edited
  in a native `<dialog>` and can be dragged, edited or deleted while a route is drawn;
  otherwise their markers take no pointer events. Labels are DOM markers rather than a
  symbol layer, because the inline map style has no glyph source for text.
- **Toolbar and tools.** A toolbar over the map carries the tools of the current scope:
  the active image (Pin, Match Towns, Skew Image | Center on Image, Move Image Here,
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
  view, base map and its colour, satellite, and each layer's visibility, opacity, blend
  mode and colours) keep their current values on undo (`withCurrentDisplay`), so
  toggling an image while looking for map features does not fill the history. Routing
  results are not steps. Open/New/reload start a new history. Every deletion is an undo
  step and is not confirmed; what cannot be undone asks first: New and Open while the
  project holds layers, routes or waypoints, and discarding a stored project that
  cannot be read (a notice action can carry such a question).
- **Base map colour.** A slider takes the colour out of the base map and the satellite,
  so that images stand out. MapLibre can desaturate raster layers (`raster-saturation`),
  but vector styles keep their colours in hundreds of layers, so a small custom layer
  (`DesaturateLayer`) sits between the base layers and the images: it copies what is
  drawn below it and draws it again in grey, mixed by the slider. It draws nothing at
  full colour. Images, routes and pins lie above it and keep their colours.
- **Image colours.** Before blending, the image shader can show an image vivid (its
  saturation doubled) or in one colour: a pixel counts as ink when it is dark or strongly
  coloured, so yellow roads and black text take the colour while paper and pale fills
  stay white. Recolouring before the blend works with every blend mode, normal included,
  and needs no extra pass. A display setting per layer (`colors`, `tint`), like blend
  and opacity.
- **Taps versus drags.** A click on the map only counts 150 ms after it was made
  (`TapFilter`): a drag that starts at the tap within that time takes it back, and a
  click where a drag ended no more than 150 ms before is dropped. The first is a mouse
  button bouncing as it is pressed to drag; the second a bounce on release, or the click
  some browsers send when a touch pan ends, which lands on the grabbed spot because that
  stays under the pointer. MapLibre's own check cannot see either: each is a separate
  press without movement. Holding the tap back instead of undoing its effect keeps every
  tool simple (a pin, a route point, a waypoint, an answer to a tap request): nothing has
  to be revoked. A press made at the tap in time decides when it ends, however long it
  is held.
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
  hands the gesture back to the map. The point markers stay visible meanwhile but cannot
  be grabbed: the rings travel with the image and the dots stay, which shows that the
  next skew pulls the image back onto its pairs. "Move image here" applies the same kind of
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
- **Names and choices are text, not fields.** Route and project names show as text with
  a pencil button; renaming swaps in a focused field in place (Enter or leaving it keeps
  the name, Esc or an empty field drops the change). The panel shows no open text fields
  apart from the search box. The base map, blend mode and colours read the same way, as
  the picked name with a pencil (`EditableChoice`), but each is a select without its box
  whose arrow is the pencil: opening a list from a separate button would need
  `showPicker()`, which not every browser supports, while a tap on the select itself
  opens the browser's own list everywhere. The swatch of a tinted image stays a colour
  input, before the name, so the pencils keep one column.
- **Help.** A (?) beside a setting opens one help on that setting in a big modal dialog:
  what the setting is for, shown by one example in pictures, and its options, each with
  when to pick it in view of the goal. There is no help per option: options make sense
  next to each other, and those without a clear use are named as such, with the advice to
  try them together with Colours and Opacity. A help has one step or up to three side by
  side (one below the other on narrow screens), each a banner with its text; the type
  allows no more, as whatever needs more steps to explain should rather become simpler.
  The banners are SVG drawings of one made-up region, as a map shows it and as a magazine
  prints it, in the same frame, so that the two match where an image fits
  (`help/drawings.tsx`). The blend help shows the image as a sheet over part of the map,
  in Normal and in Multiply, blended by the browser's own `mix-blend-mode`, which follows
  the same W3C formulas as the image shader; Vivid and One colour recolour the drawing
  with the shader's formulas (`help/paint.ts`). Drawings rather than screenshots: sharp
  on any screen, a few KB, no printed map or map tiles to license, nothing to retake when
  the look changes. Help texts are plain and structured: a few sentences on purpose, the
  options and an example where it helps, nothing the title or the captions already say
  and nothing obvious (how a slider works). The effort goes where a feature is hard to
  discover: the order of a pin pair, why a town match keeps no pairs, how the Match Towns
  dialog is used. A help can also come once, the first time a feature is used: that it
  was shown is noted in localStorage (`mappic.help.<id>`), not in the project, so it
  lasts until the site data is cleared, or for the session where storage is blocked.
  About mappic is a help as well: what the app is for, under three pictures (an image
  added, pinned and skewed, the route traced and exported). It comes on the first visit
  and from the (i) beside the title. The dialog closes with its button, Esc or a click
  beside it (`closedby="any"`); while a modal dialog is open, the map's keys (Esc, undo)
  leave it alone. Its title takes the focus when it opens (`tabindex="-1"` and
  `autofocus`; Chrome ignores `autofocus` on the dialog element itself), so reading
  starts there instead of at a ringed close button. On narrow screens three pictures take
  two lines, and their arrows are dropped, as one would end the first line pointing at
  nothing.
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
- **Placing an image by picked towns.** The user picks up to four towns on both sides:
  a Nominatim search per row, with the place picked from the results, and a tap where
  the town is on the image. Match fits a similarity transform (rotation, uniform scale,
  translation) through the complete rows: every two towns propose one, each is refitted
  by least squares on the towns within 10 % of the image diagonal, and the one most
  towns agree with wins. One wrong pick (a namesake, a tap in the wrong spot) is thus
  left out and flagged on its row instead of spoiling the placement. A similarity rather
  than the thin plate spline, because printed maps are distorted and a first placement
  should not bend the image; skewing afterwards fits it to the pairs exactly. The match
  only sets the placement, in one undo step, and flies to the image; it keeps no point
  pairs. It once did, but a town is rough on both sides (the centre of a search result,
  a tap on a symbol or a label), so its pair pulled the skew off, and its markers were
  in the way of the pairs pinned afterwards for a closer fit. Pairs pinned by hand stay.
  The tap goes through a general tap request: the next map tap goes to the requester, also
  where a marker sits (markers take no pointer events meanwhile), with a hint and a
  crosshair. Esc, Cancel, a mode change, a tool pick or another request end it; the
  requester may refuse a tap (beside the image, or with the image hidden) and keep
  waiting. The dialog does not block the map, so the image can be panned, zoomed and
  tapped while it is open; it is dragged by its title bar (a grip and a move cursor show
  where to hold it), stays partly on screen and keeps its position, and it stays open
  while a row is incomplete or left out, saying per row what is missing. Its searches
  prefer the visible area, as the panel's search does. The first time it opens, the
  help on placing an image comes with it, in two steps: towns for a first placement,
  then pairs and a skew. The (?) in its title bar shows that help again, which replaced
  the paragraph of instructions at the top of the dialog.
  What a row still needs is worked out from the row itself (`rowNote`); only "does not
  fit" is stored, by the match. Everything lives in `src/match/`, its styles included,
  so the feature can be taken out in one piece.
  Text recognition was tried first and dropped. tesseract.js (German model, self-hosted,
  about 5 MB) read the whole image, typed names were matched against the words read, and
  settlement searches found the map side automatically. On real tour maps it missed or
  garbled many labels: names under the route line or a marker, labels split over two
  lines, small print. A read took up to 16 seconds. Reading only a box drawn around a
  label did better (13 of 25 test labels against 4) but still needed correcting. Picking
  each place from search results and tapping its spot needs about as little typing and is
  exact.
- **Finding the area.** Locating uses MapLibre's GeolocateControl (one shot, no tracking).
  Search uses Nominatim on explicit submit only, since its policy forbids
  search-as-you-type; requests are spaced one second apart, identical requests cached,
  and the visible area is passed as a preference once zoomed in (zoom >= 6). It is
  rounded outward to a hundredth of a degree: rounding to the nearest value collapsed a
  street-level view into a line, which Nominatim rejects with status 400.
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
  constant in `src/config.ts`. The credits start open and fold into their (i) after five
  seconds or at the first pan, zoom or click: the OSMF attribution guidelines allow
  folding on a dismiss click, on map interaction, after five seconds, or with the credits
  on a start-up splash, but not hidden from the start. MapLibre's compact control folds by
  itself only at a drag; `foldCredits` calls the same method (`_updateCompactMinimize`)
  for the other cases.
- **Licence notices in a file.** Minification drops licence comments, so the bundle
  itself carries no notices. Vite's `build.license` writes `licenses.txt` with the
  licences of all bundled packages; a small plugin in `vite.config.ts` appends the Tabler
  Icons licence, which Vite cannot see because the icon shapes are copied into the
  source. The file sits next to `index.html` (Vite's default `.vite/` folder would be a
  hidden directory) and is linked in the footer; it only exists in builds, not on the
  development server.

## Core features

- A base map to pick, with official topographic maps for Austria, France, Germany and
  four German states, Norway, Switzerland and the USA below the maps of the world
  (OSM Standard, OpenTopoMap, TopPlusOpen, CyclOSM as raster maps; OpenFreeMap
  Liberty, Bright and Positron, VersaTiles Colorful as vector maps) and an Esri
  satellite layer on top, set by one opacity slider that turns it off at 0 (the
  default; the layer is then hidden and fetches no tiles).
- Place/address search (Nominatim) and locate-me.
- Image layers (JPEG, PNG, WebP; EXIF orientation honoured) with previews, drag
  reordering, visibility, opacity, blend modes, colours and an active layer.
- Help with drawn pictures: on blend modes and colours, behind a (?); on placing an
  image, shown with Match Towns the first time; and About, shown on the first visit and
  from the (i) beside the title.
- A map toolbar with captioned tools of the active image or the route being drawn.
- GCP editing with the Pin tool (image first, then map) or context menus (right-click or
  long press), and "skew image to map" with fold/mirror checks.
- A first placement from up to four towns, each picked from a place search and tapped on
  the image; towns that do not fit the others are left out.
- Move, rotate and resize an image by hand on the map; fly to an image or bring it
  into the view.
- Undo/redo of content edits.
- Draw route mode: append, insert, drag and delete route points; per-route OSRM
  profile; straight legs where the routing knows no way; fly to a route.
- Waypoints with name and description, independent of the routes.
- GPX export of all routes as tracks, with all waypoints.
- Project save/open/new; automatic persistence in IndexedDB including map view.
- Layout for phones and touch screens.
