import { describe, expect, it } from 'vitest'
import { describeMatch, listNames } from './report.ts'

describe('listNames', () => {
  it('joins with commas and a final "and"', () => {
    expect(listNames([])).toBe('')
    expect(listNames(['Kleve'])).toBe('Kleve')
    expect(listNames(['Kleve', 'Goch'])).toBe('Kleve and Goch')
    expect(listNames(['Kleve', 'Goch', 'Wesel'])).toBe('Kleve, Goch and Wesel')
  })
})

describe('describeMatch', () => {
  const three = ['Kleve', 'Goch', 'Wesel']

  it('names the towns used and what to do next', () => {
    expect(describeMatch(three, [])).toEqual({
      kind: 'info',
      text: 'Placed by Kleve, Goch and Wesel. Pin three or more point pairs and skew for a closer fit.',
    })
  })

  it('warns about towns left out', () => {
    expect(describeMatch(three, ['Xanten'])).toEqual({
      kind: 'warning',
      text:
        'Placed by Kleve, Goch and Wesel. Xanten does not fit the others and was left out. ' +
        'Pin three or more point pairs and skew for a closer fit.',
    })
    expect(describeMatch(three, ['Xanten', 'Emmerich']).text).toContain(
      'Xanten and Emmerich do not fit the others and were left out.',
    )
  })

  it('warns when only two towns placed the image', () => {
    const note = describeMatch(['Kleve', 'Goch'], [])
    expect(note.kind).toBe('warning')
    expect(note.text).toBe(
      'Placed by Kleve and Goch. Two towns cannot be checked against each other, so look closely. ' +
        'Pin three or more point pairs and skew for a closer fit.',
    )
  })
})
