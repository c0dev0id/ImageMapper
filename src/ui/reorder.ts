/**
 * The new position of a dragged list item: the number of other items whose middle lies
 * above the pointer. `mids` are the vertical middles of all items, the dragged one at
 * `from` included.
 */
export function reorderTarget(mids: readonly number[], from: number, y: number): number {
  return mids.filter((mid, i) => i !== from && mid < y).length
}
