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
  routing servers (routing.openstreetmap.de).
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
- **Routing.** Each leg (pair of consecutive waypoints) is requested separately from
  the FOSSGIS OSRM server for the route's profile (car, bike, foot). Results are
  cached in the route under a key built from profile and both coordinates and stored
  as polyline6 strings. A pull-based pump fetches missing legs one at a time with at
  least 1.1 s between requests (FOSSGIS allows one request per second). Legs are
  persisted so reloading never re-routes on newer OSM data.
- **State updates.** All writes go through actions; results of pure functions are
  applied with `reconcile` at the narrowest path. Components that own MapLibre
  objects are keyed by id so edits never recreate map layers.
- **Persistence.** The project is stored as JSON in IndexedDB, image bytes as
  ArrayBuffers (Safari private mode rejects Blobs). Autosave is enabled only after the
  stored project loaded successfully, so a failed load never overwrites data.
- **Project file.** A `.mappic` file is a plain ZIP with `project.json` and the
  original image bytes.
- **No migrations before 1.0.** Project files and stored data carry a version number;
  unknown versions are rejected.
- **Third-party terms.** OSM tile usage policy (attribution, no offline caching),
  FOSSGIS terms (one request per second, attribution, operator contact shown in the
  app). Esri World Imagery is used through the keyless legacy URL; Esri's terms only
  cover use with Esri software or an ArcGIS subscription. The URL is a single
  constant in `src/config.ts`.

## Core features

- OSM base map, Esri satellite layer with visibility and opacity.
- Image layers (JPEG, PNG, WebP; EXIF orientation honoured) with order, visibility,
  opacity and an active layer.
- Context-menu driven GCP editing and "skew image to map" with fold/mirror checks.
- Draw route mode: append, drag and remove waypoints; per-route OSRM profile.
- GPX export of all routes as tracks.
- Project save/open/new; automatic persistence in IndexedDB including map view.
