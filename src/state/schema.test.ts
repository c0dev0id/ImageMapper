import { describe, expect, it } from 'vitest'
import { emptyProject, hasContent, parseProject, type ImageLayer, type Project, type Route } from './schema.ts'

describe('parseProject', () => {
  it('round-trips a serialised project', () => {
    const project = { ...emptyProject(), name: 'Alps', activeLayerId: 'a' }
    expect(parseProject(JSON.stringify(project))).toEqual(project)
  })

  it('gives a project without a base map the default one', () => {
    const older: Record<string, unknown> = { ...emptyProject() }
    delete older.baseMap
    expect(parseProject(JSON.stringify(older)).baseMap).toBe('liberty')
  })

  it('rejects other versions', () => {
    const project = { ...emptyProject(), version: 1 }
    expect(() => parseProject(JSON.stringify(project))).toThrow(/version 1 is not supported/)
  })

  it('reads complete point pairs and rejects a point without its partner', () => {
    const project = (gcps: unknown[]) =>
      JSON.stringify({
        ...emptyProject(),
        layers: [{ id: 'l', name: 'scan.jpg', mime: 'image/jpeg', width: 100, height: 80, visible: true, opacity: 1, placement: [], gcps }],
      })
    expect(parseProject(project([{ id: 'g', image: [1, 2], map: [11, 48] }])).layers[0].gcps).toHaveLength(1)
    expect(() => parseProject(project([{ id: 'g', image: [1, 2] }]))).toThrow(/"scan\.jpg" holds a point without its partner/)
    expect(() => parseProject(project([{ id: 'g', map: [11, 48] }]))).toThrow(/without its partner/)
  })

  it('rejects data that is not a project', () => {
    expect(() => parseProject('{"hello": 1}')).toThrow(/not a mappic project/)
    expect(() => parseProject('[]')).toThrow(/not a mappic project/)
    expect(() => parseProject('not json')).toThrow(/not valid JSON/)
  })
})

describe('hasContent', () => {
  const layer: ImageLayer = {
    id: 'l',
    name: 'scan.jpg',
    mime: 'image/jpeg',
    width: 100,
    height: 80,
    visible: true,
    opacity: 1,
    placement: [],
    gcps: [],
  }
  const route: Route = { id: 'r', name: 'Route 1', profile: 'car', color: '#e8590c', points: [], legs: {} }

  it('is false for an empty project, whatever its name and view', () => {
    const project: Project = { ...emptyProject(), name: 'Alps', view: { center: [11, 47], zoom: 9, bearing: 0, pitch: 0 } }
    expect(hasContent(project)).toBe(false)
  })

  it('counts image layers, routes and waypoints, each on its own', () => {
    expect(hasContent({ ...emptyProject(), layers: [layer] })).toBe(true)
    expect(hasContent({ ...emptyProject(), routes: [route] })).toBe(true)
    expect(hasContent({ ...emptyProject(), waypoints: [{ id: 'w', lngLat: [11, 47], name: 'Café' }] })).toBe(true)
  })
})
