import { describe, expect, it } from 'vitest'
import { readTheme, writeTheme } from './theme.ts'

function memoryStorage(entries: Record<string, string> = {}) {
  const data = new Map(Object.entries(entries))
  return () => ({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  })
}

const blocked = () => {
  throw new DOMException('The operation is insecure.', 'SecurityError')
}

describe('readTheme', () => {
  it('reads a stored theme', () => {
    expect(readTheme(memoryStorage({ 'image-mapper.theme': 'dark' }))).toBe('dark')
    expect(readTheme(memoryStorage({ 'image-mapper.theme': 'light' }))).toBe('light')
  })

  it('has none without a choice or with an unknown value', () => {
    expect(readTheme(memoryStorage())).toBeUndefined()
    expect(readTheme(memoryStorage({ 'image-mapper.theme': 'sepia' }))).toBeUndefined()
  })

  it('has none where storage is blocked', () => {
    expect(readTheme(blocked)).toBeUndefined()
  })
})

describe('writeTheme', () => {
  it('keeps a theme that differs from the preference', () => {
    const storage = memoryStorage()
    writeTheme('dark', 'light', storage)
    expect(storage().data.get('image-mapper.theme')).toBe('dark')
  })

  it('forgets the choice when the theme equals the preference', () => {
    const storage = memoryStorage({ 'image-mapper.theme': 'dark' })
    writeTheme('light', 'light', storage)
    expect(storage().data.has('image-mapper.theme')).toBe(false)
  })

  it('does not throw where storage is blocked', () => {
    expect(() => writeTheme('dark', 'light', blocked)).not.toThrow()
  })
})
