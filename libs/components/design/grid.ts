import { resizeHandlesStyles } from '@ethlete/core/design/resize-handles';
import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import defaultActionsBase from '../src/lib/grid/grid-item-default-actions.component.css?inline';
import toolbarBase from '../src/lib/grid/grid-item-toolbar.component.css?inline';
import gridItemBase from '../src/lib/grid/grid-item.component.css?inline';
import gridBase from '../src/lib/grid/grid.component.css?inline';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { TIMES_ICON } from '../src/lib/icon/headless/times-icon';
import { buttonStyles } from './button';
import { iconMarkup } from './icon';

export type GridMockPosition = {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
};

export type GridMockItem = GridMockPosition & {
  title: string;
  /** A muted second line under the title. */
  subtitle?: string;
  /** A design marker for the item, e.g. `hover` or `focus-visible`. */
  force?: string;
  /** A design marker for the default remove action, e.g. `hover` or `focus-visible`. */
  removeForce?: string;
  /** `dragging` lifts the item off its slot by `offset`; `resizing` shows every handle, `activeEdge` held. */
  state?: 'dragging' | 'resizing';
  /** The pixel offset from the slot a dragged item follows the pointer by. */
  offset?: { x: number; y: number };
  activeEdge?: 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
};

export type GridMockOptions = {
  items: readonly GridMockItem[];
  /** Left out, 448: the content width the grid would measure, in px. */
  width?: number;
  /** Left out, 4: the columns of the active breakpoint. */
  columns?: number;
  /** Left out, 100, the component default. */
  rowHeight?: number;
  /** Left out, 16, the component default. */
  gap?: number;
  /** Draws `et-grid-item-default-actions` in every item, as a registered `actionsComponent` does. */
  actions?: boolean;
  /** The drop placeholder (`.et-grid-ghost`) at the dragged item's target slot. */
  ghost?: GridMockPosition;
  readOnly?: boolean;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

const RESIZE_EDGES = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as const;

/** The stylesheets the grid mock draws with: the real grid, grid item, toolbar, default actions and resize handle CSS. */
export const gridStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  iconButtonBase,
  resizeHandlesStyles,
  gridBase,
  gridItemBase,
  toolbarBase,
  defaultActionsBase,
  `@layer components {
  .et-grid-mock-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-sizing: border-box;
    height: 100%;
    padding: 12px;
  }
  .et-grid-mock-title {
    overflow: hidden;
    font-size: 1.4rem;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--et-surface-color-solid);
  }
  .et-grid-mock-subtitle {
    font-size: 1.2rem;
    color: var(--et-surface-color-muted-solid);
  }
}`,
].join('\n');

const geometryOf = (options: GridMockOptions) => {
  const width = options.width ?? 448;
  const columns = options.columns ?? 4;
  const gap = options.gap ?? 16;
  const rowHeight = options.rowHeight ?? 100;
  const cellWidth = Math.max(0, (width - gap * (columns - 1)) / columns);

  return { gap, rowHeight, cellWidth };
};

const rectOf = (position: GridMockPosition, geometry: ReturnType<typeof geometryOf>) => ({
  x: position.col * (geometry.cellWidth + geometry.gap),
  y: position.row * (geometry.rowHeight + geometry.gap),
  width: position.colSpan * geometry.cellWidth + (position.colSpan - 1) * geometry.gap,
  height: position.rowSpan * geometry.rowHeight + (position.rowSpan - 1) * geometry.gap,
});

const styled = (css: string) => ` style="${css}"`;

const sizeStyle = (rect: { x: number; y: number; width: number; height: number }) =>
  styled(`translate: ${rect.x}px ${rect.y}px; width: ${rect.width}px; height: ${rect.height}px;`);

const removeAction = (item: GridMockItem) =>
  `<div etGridItemAction><et-grid-item-default-actions><et-grid-item-toolbar class="et-grid-item-toolbar"><button aria-label="Remove ${item.title}" type="button" class="et-grid-item-default-actions__remove et-surface-interactive et-color-interactive et-icon-button et-focus-ring et-color--inherited" data-variant="transparent" data-size="xs"${item.removeForce ? ` data-et-force="${item.removeForce}"` : ''}><div class="et-icon-button-icon">${iconMarkup(TIMES_ICON)}</div></button></et-grid-item-toolbar></et-grid-item-default-actions></div>`;

const gridItem = (item: GridMockItem, options: GridMockOptions) => {
  const geometry = geometryOf(options);
  const slot = rectOf(item, geometry);
  const rect =
    item.state === 'dragging' && item.offset ? { ...slot, x: slot.x + item.offset.x, y: slot.y + item.offset.y } : slot;
  const classes = [
    'et-grid-item',
    'et-surface--inherited',
    item.state === 'dragging' && 'et-grid-item--dragging et-grid-item--direct',
    item.state === 'resizing' && 'et-grid-item--resizing',
  ]
    .filter(Boolean)
    .join(' ');
  const handles = RESIZE_EDGES.map((edge) => `<div class="et-resize-handle et-resize-handle--${edge}"></div>`).join('');
  const subtitle = item.subtitle ? `<div class="et-grid-mock-subtitle">${item.subtitle}</div>` : '';

  return [
    `<et-grid-item class="${classes}" data-et-surface-fill role="group" aria-label="${item.title}" tabindex="0" ${sizeStyle(rect)}${item.force ? ` data-et-force="${item.force}"` : ''}>`,
    `<div class="et-grid-item__content"><div class="et-grid-mock-content"><div class="et-grid-mock-title">${item.title}</div>${subtitle}</div></div>`,
    `<et-resize-handles class="et-resize-handles"${item.activeEdge ? ` data-active-edge="${item.activeEdge}"` : ''}${options.readOnly ? ' inert=""' : ''}>${handles}</et-resize-handles>`,
    `<div class="et-grid-item__actions">${options.actions ? removeAction(item) : ''}</div>`,
    `</et-grid-item>`,
  ].join('');
};

/** Draws an `et-grid` with its items laid out by the grid maths, at rest or mid-drag or mid-resize. */
export const grid = (options: GridMockOptions) => {
  const geometry = geometryOf(options);
  const rows = Math.max(0, ...options.items.map((item) => item.row + item.rowSpan));
  const height = rows <= 0 ? 0 : rows * geometry.rowHeight + (rows - 1) * geometry.gap;
  const classes = ['et-grid', options.readOnly && 'et-grid--readonly'].filter(Boolean).join(' ');
  const ghost = options.ghost ? `<div class="et-grid-ghost" ${sizeStyle(rectOf(options.ghost, geometry))}></div>` : '';

  return `<et-grid class="${classes}" role="region" aria-label="Dashboard" ${styled(`height: ${height}px; --et-grid-gap: ${geometry.gap}px;`)} ${options.attributes ?? ''}>${options.items.map((item) => gridItem(item, options)).join('')}${ghost}</et-grid>`;
};
