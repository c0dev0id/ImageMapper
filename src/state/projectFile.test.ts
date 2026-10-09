import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { decodeProjectFile, encodeProjectFile } from './projectFile.ts'
import { emptyProject, type Project } from './schema.ts'

const project: Project = {
  ...emptyProject(),
  name: 'Dolomites',
  layers: [
    {
      id: 'l1',
      name: 'page 42.jpg',
      mime: 'image/jpeg',
      width: 4,
      height: 3,
      visible: true,
      opacity: 0.7,
      placement: [{ image: [0, 0], map: [11, 46] }],
      gcps: [{ id: 'g1', image: [1, 2], map: [11.1, 46.1] }],
    },
  ],
  activeLayerId: 'l1',
  routes: [
    {
      id: 'r1',
      name: 'Day 1',
      profile: 'bike',
      color: '#e8590c',
      points: [{ id: 'p1', lngLat: [11.5, 46.5] }],
      legs: {},
    },
  ],
  waypoints: [{ id: 'w1', lngLat: [11.6, 46.6], name: 'Pass', description: 'Steep on the north side' }],
}
const imageBytes = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]).buffer

describe('project file', () => {
  it('round-trips the project and its image bytes', () => {
    const file = encodeProjectFile(project, new Map([['l1', imageBytes]]))
    const { project: read, images } = decodeProjectFile(file)
    expect(read).toEqual(project)
    expect(new Uint8Array(images.get('l1')!)).toEqual(new Uint8Array(imageBytes))
  })

  it('refuses to save a layer without image bytes', () => {
    expect(() => encodeProjectFile(project, new Map())).toThrow(/page 42.jpg/)
  })

  it('rejects files that are not ZIP archives', () => {
    expect(() => decodeProjectFile(strToU8('hello'))).toThrow('This is not an Image Mapper project file.')
  })

  it('rejects archives without project.json', () => {
    expect(() => decodeProjectFile(zipSync({ 'other.txt': strToU8('x') }))).toThrow(/project.json is missing/)
  })

  it('rejects archives with a missing image', () => {
    const file = zipSync({ 'project.json': strToU8(JSON.stringify(project)) })
    expect(() => decodeProjectFile(file)).toThrow(/page 42.jpg/)
  })

  it('rejects other project versions', () => {
    const file = zipSync({ 'project.json': strToU8(JSON.stringify({ ...project, version: 1 })) })
    expect(() => decodeProjectFile(file)).toThrow(/version 1/)
  })
})
