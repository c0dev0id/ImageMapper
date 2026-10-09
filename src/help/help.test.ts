import { describe, expect, it } from 'vitest'
import { firstTime } from './help.ts'

function memoryStorage(entries: Record<string, string> = {}) {
  const data = new Map(Object.entries(entries))
  return () => ({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  })
}

describe('firstTime', () => {
  it('is true once, and notes it in storage', () => {
    const storage = memoryStorage()
    expect(firstTime('a', storage)).toBe(true)
    expect(firstTime('a', storage)).toBe(false)
    expect(storage().data.get('image-mapper.help.a')).toBe('shown')
  })

  it('knows the helps shown on an earlier visit', () => {
    expect(firstTime('b', memoryStorage({ 'image-mapper.help.b': 'shown' }))).toBe(false)
  })

  it('keeps helps apart', () => {
    const storage = memoryStorage()
    expect(firstTime('c', storage)).toBe(true)
    expect(firstTime('d', storage)).toBe(true)
  })

  it('shows a help once per session where storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    expect(firstTime('e', blocked)).toBe(true)
    expect(firstTime('e', blocked)).toBe(false)
  })

  it('shows a help once per session where storage is full', () => {
    const full = () => ({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      },
    })
    expect(firstTime('f', full)).toBe(true)
    expect(firstTime('f', full)).toBe(false)
  })
})
