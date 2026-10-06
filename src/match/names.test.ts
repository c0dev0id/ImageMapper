import { describe, expect, it } from 'vitest'
import { editDistance, findName, keyWord, normalizeName, type TextWord } from './names.ts'

const word = (text: string, left = 0, top = 0): TextWord => ({ text, box: [left, top, left + 40, top + 10] })

describe('normalizeName', () => {
  it('keeps lower case letters, drops accents and turns ß into ss', () => {
    expect(normalizeName('Höhn')).toBe('hohn')
    expect(normalizeName('Großmaischeid')).toBe('grossmaischeid')
    expect(normalizeName('b.Rennerod')).toBe('brennerod')
    expect(normalizeName('Zürs,')).toBe('zurs')
    expect(normalizeName('35')).toBe('')
  })
})

describe('keyWord', () => {
  it('takes the longest word and leaves out brackets', () => {
    expect(keyWord('Bad Marienberg')).toBe('marienberg')
    expect(keyWord('Neustadt (Wied)')).toBe('neustadt')
    expect(keyWord('Selters (Westerwald)')).toBe('selters')
    expect(keyWord('Ransbach-Baumbach')).toBe('ransbach')
    expect(keyWord('St. Goar')).toBe('goar')
    expect(keyWord('  ')).toBe('')
  })
})

describe('editDistance', () => {
  it('counts insertions, deletions and substitutions', () => {
    expect(editDistance('hachenburg', 'hachenburg')).toBe(0)
    expect(editDistance('achenburg', 'hachenburg')).toBe(1)
    expect(editDistance('montabalr', 'montabaur')).toBe(1)
    expect(editDistance('marienberg', 'merenberg')).toBe(2)
    expect(editDistance('', 'goch')).toBe(4)
  })
})

describe('findName', () => {
  it('finds exact and slightly misread words, best first, at the centre of the word', () => {
    const words = [word('Montabalr', 100, 200), word('Montabaur', 300, 400), word('Wirges', 500, 50)]
    expect(findName('Montabaur', words)).toEqual([
      { at: [320, 405], distance: 0 },
      { at: [120, 205], distance: 1 },
    ])
  })

  it('tolerates more misread letters in longer names, none in short ones', () => {
    expect(findName('Hachenburg', [word('achenbürg')])).toHaveLength(1)
    expect(findName('Hachenburg', [word('Achenbvrq')])).toHaveLength(0)
    expect(findName('Hof', [word('Hof')])).toHaveLength(1)
    expect(findName('Hof', [word('Hot')])).toHaveLength(0)
    expect(findName('Goch', [word('Goah')])).toHaveLength(1)
  })

  it('finds a name read together with the next word', () => {
    expect(findName('Neustadt (Wied)', [word('Neustadt(Wied)')])).toEqual([{ at: [20, 5], distance: 2 }])
    // Short names only match whole words: "Hof" is not "Hofheim".
    expect(findName('Hof', [word('Hofheim')])).toHaveLength(0)
  })

  it('keeps the best three reads', () => {
    const words = ['Wesel', 'Wesel', 'Wesal', 'Wese1', 'Wesel'].map((t, i) => word(t, i * 50))
    const hits = findName('Wesel', words)
    expect(hits).toHaveLength(3)
    expect(hits.every((h) => h.distance === 0)).toBe(true)
  })
})
