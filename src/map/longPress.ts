export interface LongPressOptions {
  /** Hold time in milliseconds (MapLibre uses 500 ms for its own long press). */
  delay?: number
  /** Movement in CSS pixels that turns the press into a drag. */
  tolerance?: number
}

/**
 * Calls `onPress` with the client position when a touch or pen pointer rests on the target
 * for `delay` ms without moving. Mice keep using right-click. A second pointer (pinch)
 * cancels. Returns a function that removes the listeners.
 */
export function onLongPress(
  target: EventTarget,
  onPress: (clientX: number, clientY: number) => void,
  { delay = 500, tolerance = 8 }: LongPressOptions = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let start: { id: number; x: number; y: number } | undefined

  const cancel = () => {
    clearTimeout(timer)
    timer = undefined
    start = undefined
  }
  const down = (event: Event) => {
    const e = event as PointerEvent
    cancel()
    if (e.pointerType === 'mouse' || !e.isPrimary) return
    const pressed = { id: e.pointerId, x: e.clientX, y: e.clientY }
    start = pressed
    timer = setTimeout(() => {
      cancel()
      onPress(pressed.x, pressed.y)
    }, delay)
  }
  const move = (event: Event) => {
    const e = event as PointerEvent
    if (start && e.pointerId === start.id && Math.hypot(e.clientX - start.x, e.clientY - start.y) > tolerance) {
      cancel()
    }
  }
  const end = (event: Event) => {
    if (start && (event as PointerEvent).pointerId === start.id) cancel()
  }

  target.addEventListener('pointerdown', down)
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', end)
  target.addEventListener('pointercancel', end)
  return () => {
    cancel()
    target.removeEventListener('pointerdown', down)
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', end)
    target.removeEventListener('pointercancel', end)
  }
}
