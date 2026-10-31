import pickerStyles from './picker.css?inline';
import { drawing, html, slot } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import { control } from '@ethlete/components/design/control';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import menu from '@system/components/menu';
import { shellCollapse, shellCollapseStyles } from '@system/components/shell-collapse';
import { shellProjectSwitch, shellProjectSwitchStyles } from '@system/components/shell-project-switch';
import { icon, type IconName } from '@system/foundations/icons';

type Section = 'System' | 'Sketches' | 'Flows' | 'Inbox';

type Props = {
  section: Section;
  product: string;
  side: string;
  content: string;
  panel?: 'hidden';
  projectPicker?: 'open';
  studio?: string;
};

const SECTIONS: Section[] = ['System', 'Sketches', 'Flows', 'Inbox'];

const RECENT_PRODUCTS = ['studio', 'timetrack', 'docs'];

const ICONS: Record<Section, IconName> = {
  System: 'grid',
  Sketches: 'pencil',
  Flows: 'flow',
  Inbox: 'inbox',
};

type RailKind = 'section' | 'product' | 'all';

const RAIL_CONTROLS: Record<RailKind, string> = { section: 'section', product: 'product', all: 'products' };

const bubbleClass = (kind: RailKind, active: boolean, panelHidden: boolean) => {
  if (kind === 'section') {
    return `rounded-control-lg ${active ? 'text-et-theme-ink' : 'text-et-surface-muted'}${active && !panelHidden ? ' bg-et-theme/20' : ''}`;
  }

  if (kind === 'product') {
    return `rounded-control-md bg-et-surface-bg ${active ? 'text-et-surface' : 'text-et-surface-muted'}`;
  }

  return 'rounded-control-md text-et-surface-muted';
};

const railItem = (inner: string, label: string, active: boolean, kind: RailKind, panelHidden = false) =>
  `<div class="st-shell-slot relative flex justify-center w-full ${active ? `before:absolute before:left-0 ${kind === 'section' ? 'before:bg-et-theme' : 'before:bg-text'}` : ''}" data-kind="${kind}"${active ? ' data-active' : ''}>${control(
    `<button type="button"${kind === 'product' ? ' data-et-auto-surface' : ''} class="st-shell-bubble flex items-center justify-center p-0 text-ui-sm font-ui-strong ${bubbleClass(kind, active, panelHidden)}" aria-label="${label}"${active ? ` aria-current="${kind === 'section' ? 'page' : 'true'}"` : ''}>${inner}</button>`,
    RAIL_CONTROLS[kind],
  )}</div>`;

const sep = '<div class="st-shell-sep my-space-2 bg-et-surface-border"></div>';

const rail = (section: Section, product: string, panelHidden: boolean, studio: string) =>
  html`<nav class="st-shell-rail flex flex-col items-center gap-space-1 py-space-3 bg-et-surface-bg">
    <div class="st-shell-slot relative flex justify-center w-full min-h-10" data-kind="logo">${studio}</div>
    ${sep}
    ${SECTIONS.map((s) => railItem(icon(ICONS[s], { size: 20 }), s, s === section, 'section', panelHidden)).join('')}
    <div class="flex-1"></div>
    ${sep} ${RECENT_PRODUCTS.map((p) => railItem(p.charAt(0).toUpperCase(), p, p === product, 'product')).join('')}
    ${railItem(icon('more', { size: 18 }), 'All products', false, 'all')}
  </nav>`;

const sidePanel = (product: string, side: string, pickerOpen: boolean) =>
  html`<aside
    class="st-shell-side absolute top-space-3 bottom-space-3 left-space-3 flex flex-col min-h-0 overflow-hidden rounded-control-lg bg-et-surface-bg"
  >
    <header class="st-shell-side-head flex items-center justify-between box-border pr-space-2 pl-space-4">
      <span class="text-ui-lg font-ui-strong">${product}</span>
      ${shellCollapse()}
    </header>
    <div class="flex-1 min-h-0 overflow-hidden p-space-2">${side}</div>
    <footer class="st-shell-side-foot p-space-2">${shellProjectSwitch({ open: pickerOpen })}</footer>
  </aside>`;

const MENU_ITEM = 'data-et-control="item"';

const PROJECT_ROWS: MenuMockRow[] = [
  {
    kind: 'radio-group',
    items: [
      { kind: 'radio', label: 'ethlete-sdk', checked: true, active: true, attributes: MENU_ITEM },
      { kind: 'radio', label: 'fut-frontend', attributes: MENU_ITEM },
      { kind: 'radio', label: 'design-playground', attributes: MENU_ITEM },
    ],
  },
  { kind: 'separator' },
  { label: 'Projekt öffnen…', attributes: MENU_ITEM },
];

const picker = (placement: 'above' | 'beside', projectMenu: string) =>
  html`<div
    class="st-project-picker absolute box-border w-62 shadow-none ${placement === 'above' ? 'left-space-3' : 'bottom-space-3'}"
    data-placement="${placement}"
    data-et-surface="project.open"
  >
    ${projectMenu}
  </div>`;

const BASE: Props = { section: 'System', product: 'studio', side: '', content: '' };

export const shellMain = (placement: 'above' | 'beside', styles: string) => ({
  widths: [1440],
  states: {
    'project-picker': { ...BASE, projectPicker: 'open' },
    open: BASE,
    hidden: { ...BASE, panel: 'hidden' },
  } satisfies Record<string, Props>,
  controls: {
    section: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
    product: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
    products: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
    collapse: { kind: 'button' as const, part: 'components/shell-collapse' as const },
    project: {
      kind: 'select' as const,
      part: 'components/shell-project-switch' as const,
      surfaces: { open: 'project-picker' as const },
    },
  },
  render: async ({ product, section, content, side, panel, projectPicker, studio = '' }: Props) => {
    const projectMenu = await menu.render({ rows: PROJECT_ROWS });

    return drawing({
      body: html`<div
        class="st-shell relative grid overflow-hidden bg-et-surface-bg text-et-surface font-ui text-ui-md"
        data-floating${panel === 'hidden' ? ' data-panel="hidden"' : ''}
      >
        ${rail(section, product, panel === 'hidden', studio)}
        <div class="st-shell-stage relative min-w-0">
          <main class="st-shell-content absolute inset-0 min-w-0 overflow-hidden bg-et-surface-bg" ${slot('canvas')}>
            ${content}
          </main>
          ${panel === 'hidden' ? '' : sidePanel(product, side, projectPicker === 'open')}
          ${panel !== 'hidden' && projectPicker === 'open' ? picker(placement, projectMenu.body) : ''}
        </div>
      </div>`,
      styles:
        styles + pickerStyles + buttonStyles + shellCollapseStyles + shellProjectSwitchStyles + projectMenu.styles,
    });
  },
});
