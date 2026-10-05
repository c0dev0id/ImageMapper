import { For, onCleanup, Show } from 'solid-js'
import { menu, setMenu } from '../state/ui.ts'
import { useMap } from './context.ts'

const WIDTH = 210
const ITEM_HEIGHT = 32

/** The map's context menu, kept inside the map container. */
export function ContextMenu() {
  const map = useMap()
  let list: HTMLUListElement | undefined

  const onPointerDown = (e: PointerEvent) => {
    if (list && !list.contains(e.target as Node)) setMenu(undefined)
  }
  document.addEventListener('pointerdown', onPointerDown, true)
  onCleanup(() => document.removeEventListener('pointerdown', onPointerDown, true))

  const position = (m: { x: number; y: number; items: unknown[] }) => {
    const container = map.getContainer()
    const height = m.items.length * ITEM_HEIGHT + 8
    return {
      left: `${Math.max(0, Math.min(m.x, container.clientWidth - WIDTH))}px`,
      top: `${Math.max(0, Math.min(m.y, container.clientHeight - height))}px`,
    }
  }

  return (
    <Show when={menu()}>
      {(m) => (
        <ul ref={list} class="context-menu" style={position(m())} onContextMenu={(e) => e.preventDefault()}>
          <For each={m().items}>
            {(item) => (
              <li>
                <button
                  disabled={!item.enabled}
                  onClick={() => {
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
      )}
    </Show>
  )
}
