import iconStyles from '../src/lib/icon/headless/icon-styles.component.css?inline';
import treeBase from '../src/lib/tree/tree.component.css?inline';
import { CHEVRON_ICON_SVG } from './select';

export type TreeMockItem = {
  label: string;
  /** Defaults to the slash-joined labels of the item and its parents. */
  value?: string;
  /** Left out, the item is a leaf. */
  children?: TreeMockItem[];
  disabled?: boolean;
};

export type TreeMockOptions = {
  items: TreeMockItem[];
  /** The tree's `aria-label`. */
  label?: string;
  /** The values of the expanded branches. */
  expanded?: string[];
  /** The selected value, or values in `multiple` mode. */
  value?: string | string[];
  /** Defaults to `single`. */
  selectionMode?: 'none' | 'single' | 'multiple';
  /** The value of the row that holds the tab stop. Defaults to the first row. */
  active?: string;
  disabled?: boolean;
  /** Extra attributes on a row's element, by row value, e.g. design markers. */
  rowAttributes?: Record<string, string>;
};

type MockRow = { item: TreeMockItem; value: string; level: number; posInSet: number; setSize: number };

/** The stylesheets `tree()` draws with: the real `et-tree` CSS. */
export const treeStyles = /* @__PURE__ */ [iconStyles, treeBase].join('\n');

const valueOf = (item: TreeMockItem, parent: string | null) =>
  item.value ?? (parent ? `${parent}/${item.label}` : item.label);

const visibleRows = (
  items: TreeMockItem[],
  { expanded, parent, level }: { expanded: Set<string>; parent: string | null; level: number },
): MockRow[] =>
  items.flatMap((item, index) => {
    const value = valueOf(item, parent);
    const row = { item, value, level, posInSet: index + 1, setSize: items.length };
    const children =
      item.children && expanded.has(value)
        ? visibleRows(item.children, { expanded, parent: value, level: level + 1 })
        : [];

    return [row, ...children];
  });

const marker = (isBranch: boolean) =>
  `<et-tree-marker aria-hidden="true" class="et-tree-node-marker">${
    isBranch
      ? `<i etIcon="et-chevron" aria-hidden="true" class="et-tree-node-chevron et-icon et-icon--et-chevron">${CHEVRON_ICON_SVG}</i>`
      : ''
  }</et-tree-marker>`;

/** Draws `<et-tree>` with the rows its `visibleRows()` would render for `items`. */
export const tree = (options: TreeMockOptions) => {
  const mode = options.selectionMode ?? 'single';
  const expanded = new Set(options.expanded ?? []);
  const selected = new Set(
    options.value === undefined ? [] : Array.isArray(options.value) ? options.value : [options.value],
  );
  const rows = visibleRows(options.items, { expanded, parent: null, level: 1 });
  const active = rows.some((row) => row.value === options.active) ? options.active : rows[0]?.value;

  const rowHtml = (row: MockRow) => {
    const isBranch = row.item.children !== undefined;
    const isExpanded = isBranch && expanded.has(row.value);
    const isSelected = mode !== 'none' && selected.has(row.value);
    const isDisabled = !!row.item.disabled || !!options.disabled;
    const attributes = [
      options.rowAttributes?.[row.value],
      `style="--_et-tree-node-depth: ${row.level - 1};"`,
      'class="et-tree-node"',
      'role="treeitem"',
      `aria-level="${row.level}"`,
      `aria-posinset="${row.posInSet}"`,
      `aria-setsize="${row.setSize}"`,
      isBranch && `aria-expanded="${isExpanded}"`,
      mode !== 'none' && `aria-selected="${isSelected}"`,
      isDisabled && 'aria-disabled="true"',
      `tabindex="${row.value === active ? 0 : -1}"`,
      isSelected && 'data-selected="true"',
      isExpanded && 'data-expanded="true"',
      isBranch && 'data-branch="true"',
      isDisabled && 'data-disabled="true"',
    ].filter(Boolean);
    const check = mode === 'multiple' ? '<span aria-hidden="true" class="et-tree-node-check"></span>' : '';

    return `<div ${attributes.join(' ')}>${marker(isBranch)}${check}<span class="et-tree-node-label">${row.item.label}</span></div>`;
  };

  const hostAttributes = [
    'class="et-tree"',
    'role="tree"',
    options.label && `aria-label="${options.label}"`,
    mode === 'multiple' && 'aria-multiselectable="true"',
    options.disabled && 'data-disabled="true"',
  ].filter(Boolean);

  return `<et-tree ${hostAttributes.join(' ')}>${rows.map(rowHtml).join('')}</et-tree>`;
};
