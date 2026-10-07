import { For } from 'solid-js'
import { groupRuns } from './groups.ts'
import { PencilIcon } from './icons.tsx'

/**
 * A choice shown as the name of the picked option with a pencil, like an EditableName. It
 * is a select without its box: a click on the name or the pencil opens the browser's own
 * list, where options that share a `group` stand under its heading.
 */
export function EditableChoice<T extends string>(props: {
  value: T
  options: readonly { value: T; label: string; group?: string }[]
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
        <For each={groupRuns(props.options)}>
          {(run) => {
            const options = <For each={run.options}>{(o) => <option value={o.value}>{o.label}</option>}</For>
            return run.group ? <optgroup label={run.group}>{options}</optgroup> : options
          }}
        </For>
      </select>
      <PencilIcon />
    </span>
  )
}
