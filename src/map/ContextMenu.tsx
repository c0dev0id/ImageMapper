import { For, onCleanup, onMount, Show } from 'solid-js'
import { menu, setMenu } from '../state/ui.ts'
import { useMap } from './context.ts'

/** The map's context menu, kept inside the map container. */
export function ContextMenu() {
  const map = useMap()
  let list: HTMLUListElement | undefined

  const onPointerDown = (e: PointerEvent) => {
    if (list && !list.contains(e.target as Node)) setMenu(undefined)
  }
  document.addEventListener('pointerdown', onPointerDown, true)
  onCleanup(() => document.removeEventListener('pointerdown', onPointerDown, true))

  return (
    <Show when={menu()} keyed>
      {(m) => {
        // A long-press menu opens under the finger; only a new tap may choose an item.
        let armed = !m.touch
        let element!: HTMLUListElement
        // Keep the menu inside the map, using its rendered size (larger on touch screens).
        onMount(() => {
          const container = map.getContainer()
          element.style.left = `${Math.max(0, Math.min(m.x, container.clientWidth - element.offsetWidth))}px`
          element.style.top = `${Math.max(0, Math.min(m.y, container.clientHeight - element.offsetHeight))}px`
        })
        return (
          <ul
            ref={(el) => {
              element = el
              list = el
            }}
            class="context-menu"
            style={{ left: `${m.x}px`, top: `${m.y}px` }}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={() => (armed = true)}
          >
            <For each={m.items}>
              {(item) => (
                <li>
                  <button
                    disabled={!item.enabled}
                    onClick={() => {
                      if (!armed) return
                      setMenu(undefined)
                      item.run()
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              )}
            </For>
          </ul>
        )
      }}
    </Show>
  )
}
