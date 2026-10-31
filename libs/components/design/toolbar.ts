import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import { IconDefinition } from '../src/lib/icon/headless/icon-definition';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import toolbarBase from '../src/lib/toolbar/toolbar.component.css?inline';
import { buttonStyles } from './button';
import { divider, dividerStyles } from './divider';
import { iconMarkup } from './icon';

export type ToolbarMockItem =
  | {
      type: 'button';
      icon: IconDefinition;
      /** The button's `aria-label`. */
      label: string;
      /** Makes the button a toggle: `false` draws it unpressed, left out it is no toggle. */
      pressed?: boolean;
      disabled?: boolean;
      /** Extra attributes on the button, e.g. design markers. */
      attributes?: string;
    }
  | { type: 'divider' };

export type ToolbarMockOptions = {
  items: ToolbarMockItem[];
  orientation?: 'horizontal' | 'vertical';
  /** The `aria-label` naming what the toolbar acts on. */
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * The index into `items` of the button holding the toolbar's one tab stop. Left out, the first enabled
   * button, as `[etToolbar]` picks it.
   */
  tabStop?: number;
  /** Extra attributes on the toolbar, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `toolbar()` draws with: the real toolbar, icon-button, button, icon and divider CSS. */
export const toolbarStyles = /* @__PURE__ */ [buttonStyles, iconBase, iconButtonBase, dividerStyles, toolbarBase].join(
  '\n',
);

const control = (item: Extract<ToolbarMockItem, { type: 'button' }>, options: { size: string; tabStop: boolean }) => {
  const classes = [
    'et-icon-button',
    'et-color-interactive',
    'et-focus-ring',
    item.pressed ? 'et-color--inherited' : 'et-color--surface',
  ];

  const attributes = [
    item.attributes,
    `class="${classes.join(' ')}"`,
    'type="button"',
    `aria-label="${item.label}"`,
    item.disabled && 'disabled aria-disabled="true"',
    item.pressed && 'data-pressed="true"',
    item.pressed !== undefined && `aria-pressed="${item.pressed}"`,
    'data-variant="transparent"',
    `data-size="${options.size}"`,
    item.pressed && 'data-pressed-variant="tonal"',
    'data-et-toolbar-control=""',
    `tabindex="${options.tabStop ? 0 : -1}"`,
  ].filter(Boolean);

  return `<button ${attributes.join(' ')}><div class="et-icon-button-icon">${iconMarkup(item.icon)}</div></button>`;
};

/**
 * Draws `<et-toolbar>` composed as its story shows it - transparent `et-icon-button`s in the surface's neutral
 * colors that take the surrounding color theme while pressed, grouped by decorative `et-divider`s - as HTML,
 * with the roving tab stop `[etToolbar]` sets.
 */
export const toolbar = (options: ToolbarMockOptions) => {
  const { items, orientation = 'horizontal', size = 'sm' } = options;
  const tabStop = options.tabStop ?? items.findIndex((item) => item.type === 'button' && !item.disabled);

  const contents = items
    .map((item, index) =>
      item.type === 'divider'
        ? divider({ orientation: orientation === 'horizontal' ? 'vertical' : 'horizontal', decorative: true })
        : control(item, { size, tabStop: index === tabStop }),
    )
    .join('');

  const attributes = [
    options.attributes,
    'class="et-toolbar"',
    'role="toolbar"',
    `aria-orientation="${orientation}"`,
    `aria-label="${options.label ?? 'Text formatting'}"`,
  ].filter(Boolean);

  return `<et-toolbar ${attributes.join(' ')}>${contents}</et-toolbar>`;
};
