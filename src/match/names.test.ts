import { describe, expect, it } from 'vitest'
import { editDistance, findName, keyWord, labelAt, normalizeName, type TextWord } from './names.ts'

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

describe('labelAt', () => {
  const at = (text: string, left: number, top: number, width: number, height = 12): TextWord => ({
    text,
    box: [left, top, left + width, top + height],
  })
  const words = [
    at('Hachenburg', 100, 100, 80),
    at('413', 184, 101, 20),
    at('Bad', 300, 200, 24),
    at('Marienberg', 328, 200, 70),
    at('Neustadt', 500, 300, 56),
    at('(Wied)', 560, 301, 40),
    at('‚Maulsbach:', 700, 400, 70),
    at('HADAMAR', 120, 120, 90, 24),
  ]

  it('reads the word under the tap, without numbers beside it', () => {
    expect(labelAt(words, [140, 106])).toEqual({ text: 'Hachenburg', at: [140, 106] })
  })

  it('joins the words of one printed name', () => {
    expect(labelAt(words, [350, 205])?.text).toBe('Bad Marienberg')
    expect(labelAt(words, [520, 305])?.text).toBe('Neustadt (Wied)')
    expect(labelAt(words, [350, 205])?.at).toEqual([349, 206])
  })

  it('drops stray punctuation and accepts a tap just beside the word', () => {
    expect(labelAt(words, [760, 415])?.text).toBe('Maulsbach')
    expect(labelAt(words, [695, 405])?.text).toBe('Maulsbach')
  })

  it('reads nothing where no word is', () => {
    expect(labelAt(words, [600, 600])).toBeUndefined()
    expect(labelAt([at('413', 0, 0, 20)], [10, 6])).toBeUndefined()
  })

  it('does not join text of another size', () => {
    expect(labelAt(words, [160, 135])?.text).toBe('HADAMAR')
  })
})
