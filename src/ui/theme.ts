import { createEffect, createRoot, createSignal } from 'solid-js'

export type Theme = 'light' | 'dark'

/** Where a chosen theme is kept. A function, as merely reading localStorage throws where it is blocked. */
type ThemeStore = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const KEY = 'image-mapper.theme'

/** The theme chosen in this browser, if one overrides the browser's preference. */
export function readTheme(storage: ThemeStore = () => localStorage): Theme | undefined {
  try {
    const value = storage().getItem(KEY)
    return value === 'light' || value === 'dark' ? value : undefined
  } catch {
    return undefined
  }
}

/** Keeps a chosen theme, or forgets the choice. Where storage is blocked, it lasts for the session. */
export function writeTheme(choice: Theme | undefined, storage: ThemeStore = () => localStorage): void {
  try {
    if (choice) storage().setItem(KEY, choice)
    else storage().removeItem(KEY)
  } catch {
    // Storage is blocked or full: the signal has to do.
  }
}

const [preferred, setPreferred] = createSignal<Theme>('light')
const [chosen, setChosen] = createSignal<Theme>()

/** The theme in use: the one chosen in this browser, else the browser's preference. */
export const theme = (): Theme => chosen() ?? preferred()

/**
 * Switches to the other theme. A choice is only kept while it differs from the browser's
 * preference, so switching back follows the browser again, also when its preference
 * changes later.
 */
export function toggleTheme(): void {
  const next = theme() === 'dark' ? 'light' : 'dark'
  const choice = next === preferred() ? undefined : next
  writeTheme(choice)
  setChosen(choice)
}

/**
 * Tracks the browser's colour preference, which the styles follow by themselves through
 * `color-scheme`, and sets a chosen theme as `data-theme` on the document to override it.
 */
export function initTheme(): void {
  const media = matchMedia('(prefers-color-scheme: dark)')
  const update = () => setPreferred(media.matches ? 'dark' : 'light')
  update()
  media.addEventListener('change', update)
  setChosen(readTheme())
  createRoot(() => {
    createEffect(() => {
      const choice = chosen()
      if (choice) document.documentElement.dataset.theme = choice
      else delete document.documentElement.dataset.theme
    })
  })
}
