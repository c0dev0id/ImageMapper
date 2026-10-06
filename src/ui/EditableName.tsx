import { createSignal, onMount, Show } from 'solid-js'
import { PencilIcon } from './icons.tsx'

/**
 * A name shown as text with a rename button. Renaming edits it in place: Enter or leaving
 * the field keeps the new name, Esc or an empty field keeps the old one.
 */
export function EditableName(props: { value: string; label: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = createSignal(false)
  const done = (name: string | undefined) => {
    setEditing(false)
    if (name && name !== props.value) props.onRename(name)
  }
  return (
    <Show
      when={editing()}
      fallback={
        <>
          <span class="grow name" title={props.value}>
            {props.value}
          </span>
          <button class="icon" title={`Rename ${props.label}`} aria-label={`Rename ${props.label}`} onClick={() => setEditing(true)}>
            <PencilIcon />
          </button>
        </>
      }
    >
      <NameField value={props.value} label={props.label} onDone={done} />
    </Show>
  )
}

function NameField(props: { value: string; label: string; onDone: (name: string | undefined) => void }) {
  let input!: HTMLInputElement
  let finished = false
  // Enter and Esc remove the field, which may also blur it; only the first counts.
  const finish = (name: string | undefined) => {
    if (finished) return
    finished = true
    props.onDone(name?.trim())
  }
  onMount(() => {
    input.focus()
    input.select()
  })
  return (
    <input
      ref={input}
      class="grow"
      aria-label={`${props.label[0].toUpperCase()}${props.label.slice(1)} name`}
      value={props.value}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value)
        else if (e.key === 'Escape') finish(undefined)
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  )
}
