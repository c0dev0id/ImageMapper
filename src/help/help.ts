import { createSignal, type JSX } from 'solid-js'

/** One step of a help: a banner that shows what happens, and what it means. */
export interface HelpStep {
  /** Named where a help has several steps. */
  title?: string
  banner: () => JSX.Element
  text: string
  /** The options of a setting, each with when to pick it. */
  options?: readonly { name: string; text: string }[]
}

/**
 * What the help dialog shows: a banner with its text, or up to three steps side by side.
 * Whatever takes more than three steps to explain should rather become simpler.
 */
export interface Help {
  title: string
  steps: [HelpStep] | [HelpStep, HelpStep] | [HelpStep, HelpStep, HelpStep]
}

/** The help being shown; the help dialog is open while there is one. */
export const [help, setHelp] = createSignal<Help>()

/** Where shown helps are noted. A function, as merely reading localStorage throws where it is blocked. */
type NoteStore = () => Pick<Storage, 'getItem' | 'setItem'>

/** Helps shown in this session, which is all there is where storage is blocked. */
const shown = new Set<string>()

/**
 * Whether a help is shown for the first time in this browser, noting that it now is. The
 * note lasts until the site data is cleared, or for the session where storage is blocked.
 */
export function firstTime(id: string, storage: NoteStore = () => localStorage): boolean {
  const key = `image-mapper.help.${id}`
  if (shown.has(key)) return false
  shown.add(key)
  try {
    const store = storage()
    if (store.getItem(key) !== null) return false
    store.setItem(key, 'shown')
  } catch {
    // Storage is blocked or full: the session's note has to do.
  }
  return true
}

/** Shows a help the first time its feature is used in this browser. */
export function showHelpOnce(id: string, h: Help): void {
  if (firstTime(id)) setHelp(h)
}
