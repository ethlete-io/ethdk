// Demo fixtures live here rather than in the component file. An interpolated template literal
// anywhere above an inline `template:` desynchronises the Angular VS Code extension's editor-side
// scanner, which then stops forwarding template completions to the language service — see the
// `ethlete/no-template-literal-before-inline-template` lint rule.

const ITEM_COLORS = ['#7c3aed', '#c026d3', '#db2777', '#e11d48', '#ea580c', '#d97706', '#059669'] as const;

export const SCROLLABLE_ITEMS = Array.from({ length: 7 }, (_, i) => ({
  index: i,
  label: `Item ${i}`,
  active: i === 3 || i === 4,
  color: ITEM_COLORS[i],
}));
