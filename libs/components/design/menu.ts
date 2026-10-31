import { CHEVRON_ICON } from '../src/lib/icon/headless/chevron-icon';
import { IconDefinition } from '../src/lib/icon/headless/icon-definition';
import groupLabel from '../src/lib/menu/menu-group-label.component.css?inline';
import itemShortcut from '../src/lib/menu/menu-item-shortcut.component.css?inline';
import itemSubmenuIcon from '../src/lib/menu/menu-item-submenu-icon.component.css?inline';
import item from '../src/lib/menu/menu-item.component.css?inline';
import selectionItem from '../src/lib/menu/menu-selection-item.component.css?inline';
import separator from '../src/lib/menu/menu-separator.component.css?inline';
import menuBase from '../src/lib/menu/menu.component.css?inline';
import { iconMarkup } from './icon';

type MenuMockRowState = {
  disabled?: boolean;
  /** The menu's active item: the keyboard or the pointer points at it. */
  active?: boolean;
  /** Extra attributes on the row's element, e.g. design markers. */
  attributes?: string;
};

export type MenuMockItem = MenuMockRowState & {
  kind?: 'item';
  label: string;
  icon?: IconDefinition;
  shortcut?: string;
  /** Draws the item as the trigger of a submenu, with its chevron. */
  submenu?: boolean | 'open';
  destructive?: boolean;
};

export type MenuMockSelectionItem = MenuMockRowState & {
  kind: 'checkbox' | 'radio';
  label: string;
  checked?: boolean | 'mixed';
};

export type MenuMockGroup = {
  kind: 'checkbox-group' | 'radio-group';
  label?: string;
  items: MenuMockSelectionItem[];
};

export type MenuMockRow =
  MenuMockItem | MenuMockSelectionItem | MenuMockGroup | { kind: 'separator' } | { kind: 'label'; label: string };

export type MenuMockOptions = {
  rows: MenuMockRow[];
  /** Unique per frame: the ids of the panel, group labels and submenus derive from it. */
  id?: string;
  /** The app's default color theme name, as the menu syncs it from its trigger. */
  color?: string;
  /** A surface theme name the app registers, for the panel. */
  surface?: string;
};

/** The stylesheets `menu()` draws with: the real `et-menu` CSS. */
export const menuStyles = /* @__PURE__ */ [
  menuBase,
  item,
  selectionItem,
  groupLabel,
  separator,
  itemShortcut,
  itemSubmenuIcon,
].join('\n');

const rowAttributes = (row: MenuMockRowState) =>
  [
    row.attributes,
    `tabindex="${row.active && !row.disabled ? 0 : -1}"`,
    row.disabled && 'aria-disabled="true"',
    row.active && 'data-active="true"',
  ].filter(Boolean);

const menuItem = (row: MenuMockItem, submenuId: string) => {
  const attributes = [
    'et-menu-item',
    'type="button"',
    'role="menuitem"',
    ...rowAttributes(row),
    row.submenu && `aria-haspopup="menu" aria-expanded="${row.submenu === 'open'}"`,
    row.submenu === 'open' && `aria-controls="${submenuId}" data-menu-open="true"`,
    'class="et-menu-item et-color--inherited"',
    `data-variant="${row.destructive ? 'destructive' : 'default'}"`,
  ].filter(Boolean);
  const icon = row.icon ? iconMarkup(row.icon) : '';
  const shortcut = row.shortcut
    ? `<et-menu-item-shortcut class="et-menu-item-shortcut" aria-hidden="true">${row.shortcut}</et-menu-item-shortcut>`
    : '';
  const chevron = row.submenu
    ? `<et-menu-item-submenu-icon class="et-menu-item-submenu-icon" aria-hidden="true">${iconMarkup(CHEVRON_ICON)}</et-menu-item-submenu-icon>`
    : '';

  return `<button ${attributes.join(' ')}><span class="et-menu-item-icon">${icon}</span><span class="et-menu-item-content">${row.label}</span><span class="et-menu-item-trailing">${shortcut}${chevron}</span></button>`;
};

const selectionRow = (row: MenuMockSelectionItem) => {
  const attributes = [
    `role="${row.kind === 'checkbox' ? 'menuitemcheckbox' : 'menuitemradio'}"`,
    ...rowAttributes(row),
    `aria-checked="${row.checked ?? false}"`,
    `class="et-menu-item et-menu-selection-item et-menu-${row.kind}-item"`,
  ].filter(Boolean);

  return `<et-menu-${row.kind}-item ${attributes.join(' ')}><span class="et-menu-item-content">${row.label}</span><span class="et-menu-item-check" aria-hidden="true"></span></et-menu-${row.kind}-item>`;
};

const groupLabelMarkup = (label: string, id: string) =>
  `<et-menu-group-label class="et-menu-group-label" role="presentation" id="${id}">${label}</et-menu-group-label>`;

/** Draws the open `<et-menu>` panel with the DOM it renders inside its overlay. */
export const menu = (options: MenuMockOptions) => {
  const { id = 'menu' } = options;

  const rowMarkup = (row: MenuMockRow, index: number) => {
    switch (row.kind) {
      case 'separator':
        return '<et-menu-separator class="et-menu-separator" role="separator" aria-orientation="horizontal"></et-menu-separator>';
      case 'label':
        return groupLabelMarkup(row.label, `et-menu-group-label-${id}-${index}`);
      case 'checkbox':
      case 'radio':
        return selectionRow(row);
      case 'checkbox-group':
      case 'radio-group': {
        const labelId = `et-menu-group-label-${id}-${index}`;
        const label = row.label ? groupLabelMarkup(row.label, labelId) : '';
        const labelledBy = row.label ? ` aria-labelledby="${labelId}"` : '';

        return `<et-menu-${row.kind} class="et-menu-group et-menu-${row.kind}" role="group"${labelledBy}>${label}${row.items.map(selectionRow).join('')}</et-menu-${row.kind}>`;
      }
      default:
        return menuItem(row, `et-menu-panel-${id}-${index}`);
    }
  };

  const classes = [
    'et-menu',
    `et-color--${options.color ?? 'inherited'}`,
    `et-surface--${options.surface ?? 'inherited'}`,
  ];

  return `<et-menu id="et-menu-panel-${id}" class="${classes.join(' ')}" role="menu" aria-orientation="vertical" tabindex="-1"><div class="et-menu-header"><div class="et-menu-search-field"></div></div><div class="et-menu-body-wrapper"><div class="et-menu-body"><div class="et-menu-body-content">${options.rows.map(rowMarkup).join('')}</div></div></div></et-menu>`;
};
