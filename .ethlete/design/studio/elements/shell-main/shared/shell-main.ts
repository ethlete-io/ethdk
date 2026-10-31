import pickerStyles from './picker.css?inline';
import { drawing, html } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
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

type SlotKind = 'section' | 'product' | 'all';

const bubbleClass = (kind: SlotKind, active: boolean, panelHidden: boolean) => {
  if (kind === 'section') {
    return `rounded-control-lg ${active ? 'text-accent-text' : 'text-text-muted'}${active && !panelHidden ? ' bg-accent-subtle' : ''}`;
  }

  if (kind === 'product') {
    return `rounded-control-md ${active ? 'bg-surface-overlay text-text' : 'bg-surface-raised text-text-muted'}`;
  }

  return 'rounded-control-md text-text-muted';
};

const slot = (inner: string, label: string, active: boolean, kind: SlotKind, panelHidden = false) =>
  `<div class="st-shell-slot relative flex justify-center w-full${active ? ` before:absolute before:left-0 ${kind === 'section' ? 'before:bg-accent' : 'before:bg-text'}` : ''}" data-kind="${kind}"${active ? ' data-active' : ''}><span class="st-shell-bubble flex items-center justify-center text-ui-sm font-ui-strong ${bubbleClass(kind, active, panelHidden)}" title="${label}">${inner}</span></div>`;

const sep = '<div class="st-shell-sep my-space-2 bg-surface-border"></div>';

const rail = (section: Section, product: string, panelHidden: boolean, studio: string) =>
  html`<nav class="st-shell-rail flex flex-col items-center gap-space-1 py-space-3 bg-surface">
    <div class="st-shell-slot relative flex justify-center w-full min-h-10" data-kind="logo">${studio}</div>
    ${sep} ${SECTIONS.map((s) => slot(icon(ICONS[s], { size: 20 }), s, s === section, 'section', panelHidden)).join('')}
    <div class="flex-1"></div>
    ${sep} ${RECENT_PRODUCTS.map((p) => slot(p.charAt(0).toUpperCase(), p, p === product, 'product')).join('')}
    ${slot(icon('more', { size: 18 }), 'All products', false, 'all')}
  </nav>`;

const projectSwitch = html`<button
  class="st-shell-project flex items-center gap-space-2 w-full h-control-md py-0 px-space-2 rounded-control-md bg-surface-raised text-text-muted text-left"
  type="button"
  aria-haspopup="listbox"
>
  <span
    class="st-shell-project-badge flex flex-none items-center justify-center rounded-control-sm bg-surface-overlay text-text text-ui-xs font-ui-strong"
    >E</span
  >
  <span class="flex-1 min-w-0 overflow-hidden text-text text-ellipsis whitespace-nowrap">ethlete-sdk</span>
  ${icon('up-down', { size: 16 })}
</button>`;

const sidePanel = (product: string, side: string) =>
  html`<aside
    class="st-shell-side absolute top-space-3 bottom-space-3 left-space-3 flex flex-col min-h-0 overflow-hidden rounded-control-lg bg-surface"
  >
    <header class="st-shell-side-head flex items-center justify-between box-border pr-space-2 pl-space-4">
      <span class="text-ui-lg font-ui-strong">${product}</span>
      <button
        class="st-shell-collapse flex items-center justify-center size-control-sm p-0 rounded-control-md bg-surface-raised text-text"
        type="button"
        title="Hide panel"
      >
        ${icon('panel', { size: 18 })}
      </button>
    </header>
    <div class="flex-1 min-h-0 overflow-hidden p-space-2">${side}</div>
    <footer class="st-shell-side-foot p-space-2">${projectSwitch}</footer>
  </aside>`;

const pickerRow = (name: string, selected: boolean) =>
  `<div class="flex items-center min-h-control-md py-0 px-space-2 rounded-control-md${selected ? ' bg-accent-subtle text-accent-text' : ''}" role="option" aria-selected="${selected}">${name}</div>`;

const picker = (placement: 'above' | 'beside') =>
  html`<div
    class="st-project-picker absolute box-border w-62 border border-surface-border p-space-1 rounded-control-lg bg-surface-overlay${placement === 'above' ? ' left-space-3' : ' bottom-space-3'}"
    data-placement="${placement}"
  >
    <div role="listbox" aria-label="Projekt auswählen">
      ${pickerRow('ethlete-sdk', true)} ${pickerRow('fut-frontend', false)} ${pickerRow('design-playground', false)}
    </div>
    <div class="st-project-picker-action mt-space-1 border-t border-surface-border pt-space-1 rounded-none">
      ${button({
        label: 'Projekt öffnen…',
        variant: 'transparent',
        size: 'sm',
        class: 'h-control-md justify-start py-0 px-space-2',
      })}
    </div>
  </div>`;

const BASE: Props = { section: 'System', product: 'studio', side: '', content: '' };

export const shellMain = (placement: 'above' | 'beside', styles: string) => ({
  widths: [1440],
  states: {
    'project-picker': { ...BASE, projectPicker: 'open' },
    open: BASE,
    hidden: { ...BASE, panel: 'hidden' },
  } satisfies Record<string, Props>,
  render: ({ product, section, content, side, panel, projectPicker, studio = '' }: Props) => {
    return drawing({
      body: html`<div
        class="st-shell relative grid overflow-hidden bg-surface text-text font-ui text-ui-md"
        data-floating${panel === 'hidden' ? ' data-panel="hidden"' : ''}
      >
        ${rail(section, product, panel === 'hidden', studio)}
        <div class="st-shell-stage relative min-w-0">
          <main class="st-shell-content absolute inset-0 min-w-0 overflow-hidden bg-surface">${content}</main>
          ${panel === 'hidden' ? '' : sidePanel(product, side)}
          ${panel !== 'hidden' && projectPicker === 'open' ? picker(placement) : ''}
        </div>
      </div>`,
      styles: styles + pickerStyles + buttonStyles,
    });
  },
});
