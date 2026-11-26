/**
 * The item at `index`, or a thrown failure naming what was missing. A suite that indexes past the end
 * has already found a defect, and an `undefined` allowed to flow on reports it several assertions
 * later as something else entirely.
 */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];

  if (item === undefined) {
    throw new Error(`Expected an item at index ${index}, but the list holds ${items.length}.`);
  }

  return item;
}
