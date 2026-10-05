import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onLongPress } from './longPress.ts'

/** Node has no PointerEvent; a plain event with the fields the helper reads is enough. */
function pointer(type: string, fields: Partial<PointerEvent> = {}): Event {
  return Object.assign(new Event(type), { pointerType: 'touch', isPrimary: true, pointerId: 1, clientX: 100, clientY: 100, ...fields })
}

describe('onLongPress', () => {
  let target: EventTarget
  let pressed: [number, number][]

  beforeEach(() => {
    vi.useFakeTimers()
    target = new EventTarget()
    pressed = []
    onLongPress(target, (x, y) => pressed.push([x, y]))
  })
  afterEach(() => vi.useRealTimers())

  it('fires after holding a touch still', () => {
    target.dispatchEvent(pointer('pointerdown'))
    vi.advanceTimersByTime(499)
    expect(pressed).toEqual([])
    vi.advanceTimersByTime(1)
    expect(pressed).toEqual([[100, 100]])
  })

  it('works with a pen and tolerates small movements', () => {
    target.dispatchEvent(pointer('pointerdown', { pointerType: 'pen' }))
    target.dispatchEvent(pointer('pointermove', { clientX: 104, clientY: 103 }))
    vi.advanceTimersByTime(500)
    expect(pressed).toEqual([[100, 100]])
  })

  it('ignores the mouse', () => {
    target.dispatchEvent(pointer('pointerdown', { pointerType: 'mouse' }))
    vi.advanceTimersByTime(1000)
    expect(pressed).toEqual([])
  })

  it('is cancelled by lifting, moving or a second finger', () => {
    target.dispatchEvent(pointer('pointerdown'))
    target.dispatchEvent(pointer('pointerup'))
    target.dispatchEvent(pointer('pointerdown'))
    target.dispatchEvent(pointer('pointermove', { clientX: 120 }))
    target.dispatchEvent(pointer('pointerdown'))
    target.dispatchEvent(pointer('pointerdown', { pointerId: 2, isPrimary: false }))
    target.dispatchEvent(pointer('pointerdown'))
    target.dispatchEvent(pointer('pointercancel'))
    vi.advanceTimersByTime(1000)
    expect(pressed).toEqual([])
  })

  it('stops listening when disposed', () => {
    const other = new EventTarget()
    const dispose = onLongPress(other, (x, y) => pressed.push([x, y]))
    other.dispatchEvent(pointer('pointerdown'))
    dispose()
    vi.advanceTimersByTime(1000)
    other.dispatchEvent(pointer('pointerdown'))
    vi.advanceTimersByTime(1000)
    expect(pressed).toEqual([])
  })
})
