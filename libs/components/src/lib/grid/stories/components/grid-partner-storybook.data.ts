// Story helpers live here rather than in the component file. An interpolated template literal
// anywhere above an inline `template:` desynchronises the Angular VS Code extension's editor-side
// scanner, which then stops forwarding template completions to the language service — see the
// `ethlete/no-template-literal-before-inline-template` lint rule.

import { GridItemPosition } from '../../headless/grid.types';

export const posLabel = (pos: GridItemPosition | undefined) => {
  if (!pos) return '—';
  return `(${pos.col},${pos.row}) ${pos.colSpan}×${pos.rowSpan}`;
};

export const posEq = (a: GridItemPosition | undefined, b: GridItemPosition | undefined) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;
};
