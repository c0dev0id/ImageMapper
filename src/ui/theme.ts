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

/**
 * Keeps a chosen theme that differs from the browser's preference. One that equals it is
 * forgotten, so that toggling back follows the browser again, also when its preference
 * changes later. Where storage is blocked, the choice lasts for the session.
 */
export function writeTheme(theme: Theme, preferred: Theme, storage: ThemeStore = () => localStorage): void {
  try {
    if (theme === preferred) storage().removeItem(KEY)
    else storage().setItem(KEY, theme)
  } catch {
    // Storage is blocked or full: the signal has to do.
  }
}

const [preferred, setPreferred] = createSignal<Theme>('light')
const [chosen, setChosen] = createSignal<Theme>()

/** The theme in use: the one chosen in this browser, else the browser's preference. */
export const theme = (): Theme => chosen() ?? preferred()

export function toggleTheme(): void {
  const next = theme() === 'dark' ? 'light' : 'dark'
  writeTheme(next, preferred())
  setChosen(next === preferred() ? undefined : next)
}

/**
 * Follows the browser's colour preference and sets the theme in use as `data-theme` on the
 * document, which picks the `color-scheme` the styles' colours depend on.
 */
export function initTheme(): void {
  const media = matchMedia('(prefers-color-scheme: dark)')
  const update = () => setPreferred(media.matches ? 'dark' : 'light')
  update()
  media.addEventListener('change', update)
  setChosen(readTheme())
  createRoot(() => {
    createEffect(() => {
      document.documentElement.dataset.theme = theme()
    })
  })
}
