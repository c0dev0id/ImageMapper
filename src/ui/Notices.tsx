import { For, Show } from 'solid-js'
import { dismissNotice, notices } from '../state/ui.ts'

export function Notices() {
  return (
    <Show when={notices().length > 0}>
      <ul class="notices">
        <For each={notices()}>
          {(notice) => (
            <li>
              <span>{notice.text}</span>
              <Show when={notice.action}>
                {(action) => (
                  <button
                    onClick={async () => {
                      await action().run()
                      dismissNotice(notice.id)
                    }}
                  >
                    {action().label}
                  </button>
                )}
              </Show>
              <button class="icon" title="Dismiss" onClick={() => dismissNotice(notice.id)}>
                ×
              </button>
            </li>
          )}
        </For>
      </ul>
    </Show>
  )
}
