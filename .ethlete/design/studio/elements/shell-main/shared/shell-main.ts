import pickerStyles from './picker.css?inline';
import { drawing, html } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import { shellCollapse, shellCollapseStyles } from '@system/components/shell-collapse';
import { shellProjectOption, shellProjectOptionStyles } from '@system/components/shell-project-option';
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

type SlotKind = 'section' | 'product' | 'all';

const bubbleClass = (kind: SlotKind, active: boolean, panelHidden: boolean) => {
  if (kind === 'section') {
    return `rounded-control-lg ${active ? 'text-et-theme-ink' : 'text-et-surface-muted'}${active && !panelHidden ? ' bg-et-theme/20' : ''}`;
  }

  if (kind === 'product') {
    return `rounded-control-md bg-et-surface-bg ${active ? 'text-et-surface' : 'text-et-surface-muted'}`;
  }

  return 'rounded-control-md text-et-surface-muted';
};

const slot = (inner: string, label: string, active: boolean, kind: SlotKind, panelHidden = false) =>
  `<div class="st-shell-slot relative flex justify-center w-full${active ? ` before:absolute before:left-0 ${kind === 'section' ? 'before:bg-et-theme' : 'before:bg-text'}` : ''}" data-kind="${kind}"${active ? ' data-active' : ''}><span${kind === 'product' ? ' data-et-auto-surface' : ''} class="st-shell-bubble flex items-center justify-center text-ui-sm font-ui-strong ${bubbleClass(kind, active, panelHidden)}" title="${label}">${inner}</span></div>`;

const sep = '<div class="st-shell-sep my-space-2 bg-et-surface-border"></div>';

const rail = (section: Section, product: string, panelHidden: boolean, studio: string) =>
  html`<nav class="st-shell-rail flex flex-col items-center gap-space-1 py-space-3 bg-et-surface-bg">
    <div class="st-shell-slot relative flex justify-center w-full min-h-10" data-kind="logo">${studio}</div>
    ${sep} ${SECTIONS.map((s) => slot(icon(ICONS[s], { size: 20 }), s, s === section, 'section', panelHidden)).join('')}
    <div class="flex-1"></div>
    ${sep} ${RECENT_PRODUCTS.map((p) => slot(p.charAt(0).toUpperCase(), p, p === product, 'product')).join('')}
    ${slot(icon('more', { size: 18 }), 'All products', false, 'all')}
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

const picker = (placement: 'above' | 'beside') =>
  html`<div
    class="st-project-picker absolute box-border w-62 border border-et-surface-interaction p-space-1 rounded-control-lg bg-et-surface-bg${placement === 'above' ? ' left-space-3' : ' bottom-space-3'}"
    data-et-auto-surface
    data-placement="${placement}"
    data-et-surface="project.open"
  >
    <div role="listbox" aria-label="Projekt auswählen">
      ${shellProjectOption({ name: 'ethlete-sdk', selected: true })} ${shellProjectOption({ name: 'fut-frontend' })}
      ${shellProjectOption({ name: 'design-playground' })}
    </div>
    <div class="st-project-picker-action mt-space-1 border-t border-et-surface-border pt-space-1 rounded-none">
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
  controls: {
    collapse: { kind: 'button' as const, part: 'components/shell-collapse' as const },
    project: {
      kind: 'select' as const,
      part: 'components/shell-project-switch' as const,
      surfaces: { open: 'project-picker' as const },
    },
    option: { kind: 'row' as const, part: 'components/shell-project-option' as const },
  },
  render: ({ product, section, content, side, panel, projectPicker, studio = '' }: Props) => {
    return drawing({
      body: html`<div
        class="st-shell relative grid overflow-hidden bg-et-surface-bg text-et-surface font-ui text-ui-md"
        data-floating${panel === 'hidden' ? ' data-panel="hidden"' : ''}
      >
        ${rail(section, product, panel === 'hidden', studio)}
        <div class="st-shell-stage relative min-w-0">
          <main class="st-shell-content absolute inset-0 min-w-0 overflow-hidden bg-et-surface-bg">${content}</main>
          ${panel === 'hidden' ? '' : sidePanel(product, side, projectPicker === 'open')}
          ${panel !== 'hidden' && projectPicker === 'open' ? picker(placement) : ''}
        </div>
      </div>`,
      styles:
        styles +
        pickerStyles +
        buttonStyles +
        shellCollapseStyles +
        shellProjectSwitchStyles +
        shellProjectOptionStyles,
    });
  },
});
