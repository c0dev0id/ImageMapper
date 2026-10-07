/** Options in runs of the same group, in their order; options without a group form runs too. */
export function groupRuns<T extends { group?: string }>(options: readonly T[]): { group?: string; options: T[] }[] {
  const runs: { group?: string; options: T[] }[] = []
  for (const option of options) {
    const last = runs.at(-1)
    if (last && last.group === option.group) last.options.push(option)
    else runs.push({ group: option.group, options: [option] })
  }
  return runs
}
