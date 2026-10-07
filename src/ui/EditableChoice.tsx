import { For } from 'solid-js'
import { PencilIcon } from './icons.tsx'

/**
 * A choice shown as the name of the picked option with a pencil, like an EditableName. It
 * is a select without its box: a click on the name or the pencil opens the browser's own
 * list.
 */
export function EditableChoice<T extends string>(props: {
  value: T
  options: readonly { value: T; label: string }[]
  label: string
  title: string
  onChange: (value: T) => void
}) {
  return (
    <span class="choice grow">
      <select
        aria-label={props.label}
        title={props.title}
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value as T)}
      >
        <For each={props.options}>{(o) => <option value={o.value}>{o.label}</option>}</For>
      </select>
      <PencilIcon />
    </span>
  )
}
