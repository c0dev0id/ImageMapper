import { createEffect, For, Show } from 'solid-js'
import { HelpIcon } from '../ui/icons.tsx'
import { help, setHelp, type Help } from './help.ts'
import './Help.css'

/**
 * The help, in a big modal dialog in the middle of the screen: one banner with its text, or
 * up to three steps side by side (one below the other on narrow screens). The close button,
 * Esc or a click beside the dialog closes it.
 */
export function HelpDialog() {
  let dialog!: HTMLDialogElement
  createEffect(() => {
    const open = help() !== undefined
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  })
  return (
    <dialog ref={dialog} class="dialog help" closedby="any" aria-labelledby="help-title" onClose={() => setHelp(undefined)}>
      <Show when={help()} keyed>
        {(h) => (
          <>
            <div class="help-head">
              <h2 id="help-title">{h.title}</h2>
              <button type="button" class="icon" title="Close" aria-label="Close help" onClick={() => setHelp(undefined)}>
                ×
              </button>
            </div>
            <ol class="help-steps">
              <For each={h.steps}>
                {(step, i) => (
                  <li>
                    <Show when={h.steps.length > 1}>
                      <h3>
                        <span class="step-number">{i() + 1}</span>
                        {step.title}
                      </h3>
                    </Show>
                    <step.banner />
                    <p>{step.text}</p>
                  </li>
                )}
              </For>
            </ol>
          </>
        )}
      </Show>
    </dialog>
  )
}

/** The (?) of a setting or a dialog: shows its help. */
export function HelpButton(props: { label: string; help: () => Help }) {
  return (
    <button
      type="button"
      class="icon help-button"
      title={props.label}
      aria-label={props.label}
      onClick={() => setHelp(props.help())}
    >
      <HelpIcon />
    </button>
  )
}
