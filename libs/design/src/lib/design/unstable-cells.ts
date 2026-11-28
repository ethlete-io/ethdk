import { boundsOf, ChangedBox, SheetCell } from './contact-sheet';
import { BoxOf } from './variant-diff';

export type UnstableCell = { label: string; part: string; state: string; pixels: number; box: ChangedBox | null };

export const unstableCellsOf = async (options: {
  plan: { label: string; address: { part: string; state: string } }[][];
  first: SheetCell[][];
  second: SheetCell[][];
  boxOf: BoxOf;
  pixelsOf: (before: Buffer, after: Buffer) => Promise<number>;
}): Promise<UnstableCell[]> => {
  const found: UnstableCell[] = [];

  for (const [rowIndex, row] of options.plan.entries()) {
    for (const [index, { label, address }] of row.entries()) {
      const before = options.first[rowIndex]?.[index];
      const after = options.second[rowIndex]?.[index];

      if (!before || !after || !('png' in before) || !('png' in after) || before.png.equals(after.png)) continue;

      found.push({
        label,
        part: address.part,
        state: address.state,
        pixels: await options.pixelsOf(before.png, after.png),
        box: boundsOf(await options.boxOf(before.png, after.png)),
      });
    }
  }

  return found;
};

export const unstableReportOf = (cells: UnstableCell[]) =>
  cells.map(({ label, part, state, pixels, box }) => {
    const where = box ? ` in ${box.x},${box.y} ${box.width}x${box.height}` : '';

    return `design-explore: ${part} state "${state}" (${label}) draws differently in two renders: ${pixels} px differ${where}`;
  });
