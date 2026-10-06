import { describe, expect, it } from 'vitest'
import { emptyProject, parseProject } from './schema.ts'

describe('parseProject', () => {
  it('round-trips a serialised project', () => {
    const project = { ...emptyProject(), name: 'Alps', activeLayerId: 'a' }
    expect(parseProject(JSON.stringify(project))).toEqual(project)
  })

  it('rejects other versions', () => {
    const project = { ...emptyProject(), version: 1 }
    expect(() => parseProject(JSON.stringify(project))).toThrow(/version 1 is not supported/)
  })

  it('rejects data that is not a project', () => {
    expect(() => parseProject('{"hello": 1}')).toThrow(/not a mappic project/)
    expect(() => parseProject('[]')).toThrow(/not a mappic project/)
    expect(() => parseProject('not json')).toThrow(/not valid JSON/)
  })
})
