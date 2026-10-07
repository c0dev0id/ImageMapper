/** How long a tap waits for a drag to show it was none, and how long after a drag a click belongs to it. */
export const BOUNCE_MS = 150

/** How far a press may travel and still be a tap, in CSS pixels: fingers wobble more than mice. */
const SLOP = { mouse: 5, touch: 12 }

/** Where and when a pointer was, with its time in the clock of DOM event time stamps. */
export interface PointerSample {
  x: number
  y: number
  t: number
  touch: boolean
}

interface Press extends PointerSample {
  dragged: boolean
}

interface Waiting extends PointerSample {
  run: () => void
  /** BOUNCE_MS have passed; only a press made at the tap within that time still decides. */
  elapsed: boolean
  timer: ReturnType<typeof setTimeout>
}

const slop = (p: PointerSample) => (p.touch ? SLOP.touch : SLOP.mouse)
const distance = (a: PointerSample, b: PointerSample) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Tells taps on the map from the clicks that come with dragging it: a mouse button that
 * bounces when pressed or released, or a browser that sends a click when a touch pan ends.
 * A tap only counts BOUNCE_MS after it was made, and not at all if a drag starts at the
 * tap within that time; a click where a drag ended no more than BOUNCE_MS before is
 * dropped. A press elsewhere, the next click or a key (`flush`) lets a waiting tap through
 * at once, so that it never comes after what followed it. Fed with the primary pointer's
 * down, move and up events and the map's clicks.
 */
export class TapFilter {
  private press: Press | undefined
  private dragEnd: PointerSample | undefined
  private waiting: Waiting | undefined

  down(p: PointerSample): void {
    if (this.waiting && distance(this.waiting, p) > slop(p)) this.settle()
    this.press = { ...p, dragged: false }
  }

  move(p: PointerSample): void {
    const press = this.press
    if (!press || press.dragged || distance(press, p) <= slop(press)) return
    press.dragged = true
    if (this.pressedAtWaitingTap()) this.drop()
  }

  up(p: PointerSample): void {
    if (this.press?.dragged) this.dragEnd = p
    else if (this.waiting?.elapsed && this.pressedAtWaitingTap()) this.settle()
    this.press = undefined
  }

  /** A click on the map: `run` follows once it counts as a tap, or never. */
  click(p: PointerSample, run: () => void): void {
    const end = this.dragEnd
    if (end && p.t - end.t <= BOUNCE_MS && distance(end, p) <= slop(p)) return
    // A tap made while another waits ends that wait: both were meant.
    if (this.waiting) this.settle()
    const waiting: Waiting = {
      ...p,
      run,
      elapsed: false,
      timer: setTimeout(() => {
        waiting.elapsed = true
        if (!this.pressedAtWaitingTap()) this.settle()
      }, BOUNCE_MS),
    }
    this.waiting = waiting
  }

  /** Lets a waiting tap through now, before something else happens. */
  flush(): void {
    this.settle()
  }

  /** Whether the current press began at the waiting tap, soon enough to be its bounce. */
  private pressedAtWaitingTap(): boolean {
    const { press, waiting } = this
    return !!press && !!waiting && press.t >= waiting.t && press.t - waiting.t <= BOUNCE_MS && distance(press, waiting) <= slop(press)
  }

  private settle(): void {
    const waiting = this.waiting
    if (!waiting) return
    this.drop()
    waiting.run()
  }

  private drop(): void {
    if (this.waiting) clearTimeout(this.waiting.timer)
    this.waiting = undefined
  }
}
