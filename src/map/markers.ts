import * as maplibregl from 'maplibre-gl'
import type { LngLat } from '../geo/types.ts'

/** True if a DOM event originated from a marker (the map's click fires after the marker's). */
export function fromMarker(event: Event | undefined): boolean {
  return event?.target instanceof Element && event.target.closest('.maplibregl-marker') !== null
}

/**
 * A marker whose root element is owned by MapLibre (it sets transform, opacity and
 * pointer-events); the given content is placed inside it.
 */
export class MarkerHandle {
  readonly marker: maplibregl.Marker
  readonly root: HTMLDivElement
  private added = false

  constructor(
    private readonly map: maplibregl.Map,
    content: Node,
    options: { className: string; draggable?: boolean },
  ) {
    this.root = document.createElement('div')
    this.root.className = options.className
    this.root.append(content)
    this.marker = new maplibregl.Marker({ element: this.root, draggable: options.draggable ?? false })
    if (options.draggable) {
      // MapLibre starts a marker drag with any button. A right-click opens a menu under the
      // pointer that receives the release, which MapLibre never sees: the marker would
      // then follow the mouse. Only the primary button may drag.
      this.root.addEventListener('mousedown', (e) => {
        if (e.button !== 0) e.stopPropagation()
      })
    }
  }

  /** Shows the marker at a position, or hides it for undefined. */
  setPosition(position: LngLat | undefined): void {
    if (!position) {
      this.remove()
      return
    }
    this.marker.setLngLat(position)
    if (!this.added) {
      this.marker.addTo(this.map)
      this.added = true
    }
  }

  remove(): void {
    this.marker.remove()
    this.added = false
  }
}
