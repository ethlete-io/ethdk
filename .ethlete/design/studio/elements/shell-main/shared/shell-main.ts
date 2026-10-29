import pickerStyles from './picker.css?inline';
import { drawing, html } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';

type Section = 'System' | 'Sketches' | 'Flows' | 'Inbox';

type Props = {
  section: Section;
  product: string;
  side: string;
  content: string;
  panel?: 'hidden';
  projectPicker?: 'open';
};

const SECTIONS: Section[] = ['System', 'Sketches', 'Flows', 'Inbox'];

const RECENT_PRODUCTS = ['studio', 'timetrack', 'docs'];

const ICONS: Record<Section, string> = {
  System:
    '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  Sketches: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  Flows: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H14a4 4 0 0 1 4 4v5.5"/>',
  Inbox: '<path d="M4 13 6.5 6h11l2.5 7v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20"/>',
};

const icon = (paths: string, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ALL = '<circle cx="5.5" cy="12" r="1.25"/><circle cx="12" cy="12" r="1.25"/><circle cx="18.5" cy="12" r="1.25"/>';
const UP_DOWN = '<path d="m8 9 4-4 4 4"/><path d="m8 15 4 4 4-4"/>';
const PANEL = '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>';

const mark = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" role="img" aria-label="Ethlete Studio"><path d="M21.17 8.62 A5.5 5.5 0 1 0 16 16 A5.5 5.5 0 1 1 10.83 23.38" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>`;

const slot = (inner: string, label: string, active: boolean, kind: string) =>
  `<div class="st-shell-slot" data-kind="${kind}"${active ? ' data-active' : ''}><span class="st-shell-bubble" title="${label}">${inner}</span></div>`;

const rail = (section: Section, product: string) =>
  html`<nav class="st-shell-rail">
    <div class="st-shell-slot" data-kind="logo"><span class="st-shell-logo">${mark(24)}</span></div>
    <div class="st-shell-sep"></div>
    ${SECTIONS.map((s) => slot(icon(ICONS[s]), s, s === section, 'section')).join('')}
    <div class="st-shell-rail-gap"></div>
    <div class="st-shell-sep"></div>
    ${RECENT_PRODUCTS.map((p) => slot(p.charAt(0).toUpperCase(), p, p === product, 'product')).join('')}
    ${slot(icon(ALL, 18), 'All products', false, 'all')}
  </nav>`;

const projectSwitch = html`<button class="st-shell-project" type="button" aria-haspopup="listbox">
  <span class="st-shell-project-badge">E</span>
  <span class="st-shell-project-name">ethlete-sdk</span>
  ${icon(UP_DOWN, 16)}
</button>`;

const sidePanel = (product: string, side: string) =>
  html`<aside class="st-shell-side">
    <header class="st-shell-side-head">
      <span class="st-shell-side-title">${product}</span>
      <button class="st-shell-collapse" type="button" title="Hide panel">${icon(PANEL, 18)}</button>
    </header>
    <div class="st-shell-side-list">${side}</div>
    <footer class="st-shell-side-foot">${projectSwitch}</footer>
  </aside>`;

const picker = (placement: 'above' | 'beside') =>
  html`<div class="st-project-picker" data-placement="${placement}">
    <div role="listbox" aria-label="Projekt auswählen">
      <div class="st-project-picker-row" role="option" aria-selected="true">ethlete-sdk</div>
      <div class="st-project-picker-row" role="option" aria-selected="false">fut-frontend</div>
      <div class="st-project-picker-row" role="option" aria-selected="false">design-playground</div>
    </div>
    <div class="st-project-picker-action">
      ${button({ label: 'Projekt öffnen…', variant: 'transparent', size: 'sm' })}
    </div>
  </div>`;

export const shellMain = (placement: 'above' | 'beside', styles: string) => ({
  widths: [1440],
  states: {
    'project-picker': { section: 'System', product: 'studio', side: '', content: '', projectPicker: 'open' },
    open: {
      section: 'System',
      product: 'studio',
      side: '',
      content: '',
    },
    hidden: {
      section: 'System',
      product: 'studio',
      side: '',
      content: '',
      panel: 'hidden',
    },
  } satisfies Record<string, Props>,
  render: ({ product, section, content, side, panel, projectPicker }: Props) =>
    drawing({
      body: html`<div class="st-shell" data-floating${panel === 'hidden' ? ' data-panel="hidden"' : ''}>
        ${rail(section, product)}
        <div class="st-shell-stage">
          <main class="st-shell-content">${content}</main>
          ${panel === 'hidden' ? '' : sidePanel(product, side)}
          ${panel !== 'hidden' && projectPicker === 'open' ? picker(placement) : ''}
        </div>
      </div>`,
      styles: styles + pickerStyles + (projectPicker === 'open' ? buttonStyles : ''),
    }),
});
