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
};

const SECTIONS: Section[] = ['System', 'Sketches', 'Flows', 'Inbox'];

const RECENT_PRODUCTS = ['studio', 'timetrack', 'docs'];

const ICONS: Record<Section, IconName> = {
  System: 'grid',
  Sketches: 'pencil',
  Flows: 'flow',
  Inbox: 'inbox',
};

const mark = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" role="img" aria-label="Ethlete Studio"><path d="M21.17 8.62 A5.5 5.5 0 1 0 16 16 A5.5 5.5 0 1 1 10.83 23.38" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>`;

const slot = (inner: string, label: string, active: boolean, kind: string) =>
  `<div class="st-shell-slot" data-kind="${kind}"${active ? ' data-active' : ''}><span class="st-shell-bubble" title="${label}">${inner}</span></div>`;

const rail = (section: Section, product: string) =>
  html`<nav class="st-shell-rail">
    <div class="st-shell-slot" data-kind="logo"><span class="st-shell-logo">${mark(24)}</span></div>
    <div class="st-shell-sep"></div>
    ${SECTIONS.map((s) => slot(icon(ICONS[s], { size: 20 }), s, s === section, 'section')).join('')}
    <div class="st-shell-rail-gap"></div>
    <div class="st-shell-sep"></div>
    ${RECENT_PRODUCTS.map((p) => slot(p.charAt(0).toUpperCase(), p, p === product, 'product')).join('')}
    ${slot(icon('more', { size: 18 }), 'All products', false, 'all')}
  </nav>`;

const projectSwitch = html`<button class="st-shell-project" type="button" aria-haspopup="listbox">
  <span class="st-shell-project-badge">E</span>
  <span class="st-shell-project-name">ethlete-sdk</span>
  ${icon('up-down', { size: 16 })}
</button>`;

const sidePanel = (product: string, side: string) =>
  html`<aside class="st-shell-side">
    <header class="st-shell-side-head">
      <span class="st-shell-side-title">${product}</span>
      <button class="st-shell-collapse" type="button" title="Hide panel">${icon('panel', { size: 18 })}</button>
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
