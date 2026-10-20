import { describe, expect, it } from 'vitest'
import { formatDistance } from './distance.ts'

describe('formatDistance', () => {
  it('shows whole metres below a kilometre', () => {
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(12.4)).toBe('12 m')
    expect(formatDistance(999.4)).toBe('999 m')
  })

  it('shows kilometres to three significant digits', () => {
    expect(formatDistance(1234)).toBe('1.23 km')
    expect(formatDistance(12_345)).toBe('12.3 km')
    expect(formatDistance(123_456)).toBe('123 km')
    expect(formatDistance(1_234_567)).toBe('1235 km')
  })

  it('takes one digit less where rounding reaches the next power of ten', () => {
    expect(formatDistance(999.5)).toBe('1.00 km')
    expect(formatDistance(9994)).toBe('9.99 km')
    expect(formatDistance(9995)).toBe('10.0 km')
    expect(formatDistance(99_949)).toBe('99.9 km')
    expect(formatDistance(99_950)).toBe('100 km')
  })
})
