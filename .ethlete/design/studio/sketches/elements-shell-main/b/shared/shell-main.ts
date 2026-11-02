import pickerStyles from '@shared/picker.css?inline';
import { drawing, html, interactionRows, slot, type Interaction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import menu from '@system/components/menu';
import { shellCollapse, shellCollapseStyles } from '@system/components/shell-collapse';
import { shellProduct, shellProductStyles } from '@system/components/shell-product';
import { shellSection, shellSectionStyles } from '@system/components/shell-section';
import { shellProjectSwitch, shellProjectSwitchStyles } from '@system/components/shell-project-switch';
import titleBar from '@system/components/title-bar';
import type { IconName } from '@system/foundations/icons';

type Section = 'System' | 'Sketches' | 'Flows' | 'Inbox';

type Chrome = Pick<Parameters<typeof titleBar.render>[0], 'os' | 'left' | 'right'>;

const LINUX_CHROME: Chrome = { os: 'linux', left: [], right: ['minimize', 'maximize', 'close'] };

type Props = {
  section: Section;
  product: string;
  side: string;
  content: string;
  panel?: 'hidden';
  projectPicker?: 'open';
  pickerKeyboard?: boolean;
  switchFocus?: boolean;
  studio?: string;
  force?: RailForce;
  server?: 'stopped' | 'starting';
  log?: string[];
  chrome?: Chrome;
  update?: boolean;
};

const SECTIONS: Section[] = ['System', 'Sketches', 'Flows', 'Inbox'];

const RECENT_PRODUCTS = ['studio', 'timetrack', 'docs'];

const ICONS: Record<Section, IconName> = {
  System: 'grid',
  Sketches: 'pencil',
  Flows: 'flow',
  Inbox: 'inbox',
};

type RailKind = 'section' | 'product';

type RailInteraction = Exclude<Interaction, 'disabled'>;

type RailForce = { label: string; interaction: RailInteraction };

const interactionOf = (label: string, force?: RailForce) =>
  force?.label === label ? { interaction: force.interaction } : {};

const railSlot = (kind: RailKind, active: boolean, markup: string) =>
  `<div class="st-shell-slot relative flex justify-center w-full ${active ? `before:absolute before:left-0 ${kind === 'section' ? 'before:bg-et-theme' : 'before:bg-text'}` : ''}" data-kind="${kind}"${active ? ' data-active' : ''}>${markup}</div>`;

const sep = '<div class="st-shell-sep my-space-2 bg-et-surface-border"></div>';

const rail = (section: Section, product: string, panelHidden: boolean, studio: string, force?: RailForce) =>
  html`<nav class="st-shell-rail row-start-2 flex flex-col items-center gap-space-1 py-space-3 bg-et-surface-bg">
    <div class="st-shell-slot relative flex justify-center w-full min-h-10" data-kind="logo">${studio}</div>
    ${sep}
    ${SECTIONS.map((s) =>
      railSlot(
        'section',
        s === section,
        shellSection({ icon: ICONS[s], label: s, active: s === section, panelHidden, ...interactionOf(s, force) }),
      ),
    ).join('')}
    <div class="flex-1"></div>
    ${sep}
    ${RECENT_PRODUCTS.map((p) =>
      railSlot(
        'product',
        p === product,
        shellProduct({ product: p, active: p === product, ...interactionOf(p, force) }),
      ),
    ).join('')}
  </nav>`;

const sidePanel = (product: string, side: string, pickerOpen: boolean, switchFocus: boolean) =>
  html`<aside
    class="st-shell-side absolute top-space-3 bottom-space-3 left-space-3 flex flex-col min-h-0 overflow-hidden rounded-control-lg bg-et-surface-bg"
  >
    <header class="st-shell-side-head flex items-center justify-between box-border pr-space-2 pl-space-4">
      <span class="text-ui-lg font-ui-strong">${product}</span>
      ${shellCollapse()}
    </header>
    <div class="flex-1 min-h-0 overflow-hidden p-space-2">${side}</div>
    <footer class="st-shell-side-foot p-space-2">
      ${shellProjectSwitch({ open: pickerOpen, ...(switchFocus ? { interaction: 'focus-visible' as const } : {}) }, { open: 'project-picker', closed: 'open' })}
    </footer>
  </aside>`;

const MENU_ITEM = 'data-et-control="item"';

const projectRows = (keyboard: boolean): MenuMockRow[] => [
  {
    kind: 'radio-group',
    items: [
      {
        kind: 'radio',
        label: 'ethlete-sdk',
        checked: true,
        active: true,
        ...(keyboard ? { activeSource: 'keyboard' as const } : {}),
        attributes: `${MENU_ITEM} data-et-action="open"${keyboard ? ' data-et-force="focus-visible"' : ''}`,
      },
      { kind: 'radio', label: 'fut-frontend', attributes: `${MENU_ITEM} data-et-action="emit:projectChange"` },
      { kind: 'radio', label: 'design-playground', attributes: `${MENU_ITEM} data-et-action="emit:projectChange"` },
    ],
  },
  { kind: 'separator' },
  { label: 'Projekt öffnen…', attributes: `${MENU_ITEM} data-et-action="emit:openProject"` },
];

const picker = (placement: 'above' | 'beside', projectMenu: string) =>
  html`<div
    class="st-project-picker absolute box-border w-62 shadow-none ${placement === 'above' ? 'left-space-3' : 'bottom-space-3'}"
    data-placement="${placement}"
    data-et-surface="project.open"
  >
    ${projectMenu}
  </div>`;

const SERVER_LOG = [
  'vite v7.1.4 dev server running at http://localhost:4402/',
  'Error: EADDRINUSE: address already in use :::4402',
  'design server exited with code 1',
];

const restartButton = button({
  label: 'Neu starten',
  variant: 'outline',
  color: 'surface',
  size: 'sm',
}).replace(/^<button /, '<button data-et-control="restart" data-et-action="emit:restartServer" ');

const serverScreen = (server: 'stopped' | 'starting', log: string[]) =>
  html`<div class="box-border size-full overflow-auto pl-(--st-shell-inset-left)">
    ${
      server === 'starting'
        ? html`<div class="mx-auto mt-15 w-full max-w-6xl box-border px-space-5">
            <h3 class="m-0 text-ui-lg font-ui-strong text-et-surface">Design-Server startet</h3>
          </div>`
        : html`<div
            class="mx-auto mt-15 flex w-full max-w-6xl box-border flex-col items-start gap-space-3 px-space-5 text-ui-sm text-et-surface-muted"
            role="alert"
          >
            <h3 class="m-0 text-ui-lg font-ui-strong text-et-surface">Design-Server gestoppt</h3>
            ${
              log.length
                ? html`<pre
                    class="m-0 box-border max-h-60 w-full overflow-auto rounded-control-md bg-et-surface-interaction/6 p-space-3 font-code text-ui-xs whitespace-pre-wrap"
                  >
${log.join('\n')}</pre>`
                : ''
            }
            ${restartButton}
          </div>`
    }
  </div>`;

const BASE: Props = {
  section: 'System',
  product: 'studio',
  side: '',
  content: '',
  chrome: LINUX_CHROME,
  update: false,
};

const railRowsOf = <const TRow extends string>(row: TRow, label: string) =>
  interactionRows<Props, TRow, RailInteraction>({ [row]: BASE } as Record<TRow, Props>, {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props, interaction) => ({ ...props, force: { label, interaction } }),
  });

const sectionRows = railRowsOf('section', 'Sketches');
const productRows = railRowsOf('product', 'timetrack');

export const shellMain = (placement: 'above' | 'beside', styles: string) => ({
  widths: [1440],
  states: {
    'project-picker': { ...BASE, projectPicker: 'open' },
    'project-picker-focus-visible': { ...BASE, projectPicker: 'open', pickerKeyboard: true },
    'server-stopped': { ...BASE, server: 'stopped', log: SERVER_LOG },
    'server-starting': { ...BASE, server: 'starting' },
    open: BASE,
    'open-focus-visible': { ...BASE, switchFocus: true },
    hidden: { ...BASE, panel: 'hidden' },
    ...sectionRows.states,
    ...productRows.states,
  } satisfies Record<string, Props>,
  grid: { columns: sectionRows.grid.columns, rows: { ...sectionRows.grid.rows, ...productRows.grid.rows } },
  controls: {
    section: { kind: 'button' as const, part: 'components/shell-section' as const },
    product: { kind: 'button' as const, part: 'components/shell-product' as const },
    collapse: { kind: 'button' as const, part: 'components/shell-collapse' as const },
    restart: { kind: 'button' as const, part: 'components/button' as const },
    project: {
      kind: 'select' as const,
      part: 'components/shell-project-switch' as const,
      surfaces: { open: 'project-picker' as const },
    },
  },
  render: async ({
    product,
    section,
    content,
    side,
    panel,
    projectPicker,
    pickerKeyboard = false,
    switchFocus = false,
    studio = '',
    force,
    server,
    log = [],
    chrome = LINUX_CHROME,
    update = false,
  }: Props) => {
    const projectMenu = await menu.render({ rows: projectRows(pickerKeyboard) });
    const bar = await titleBar.render({ ...chrome, update, product, part: '' });

    return drawing({
      body: html`<div
        class="st-shell relative grid overflow-hidden bg-et-surface-bg text-et-surface font-ui text-ui-md"
        data-et-surface
        data-floating${panel === 'hidden' ? ' data-panel="hidden"' : ''}
      >
        <div class="col-span-full">${bar.body}</div>
        ${rail(section, product, panel === 'hidden', studio, force)}
        <div class="st-shell-stage relative row-start-2 min-w-0">
          <main
            class="st-shell-content absolute inset-0 min-w-0 overflow-hidden bg-et-surface-bg"
            ${server ? '' : slot('canvas')}
          >
            ${server ? serverScreen(server, log) : content}
          </main>
          ${panel === 'hidden' ? '' : sidePanel(product, side, projectPicker === 'open', switchFocus)}
          ${panel !== 'hidden' && projectPicker === 'open' ? picker(placement, projectMenu.body) : ''}
        </div>
      </div>`,
      styles:
        styles +
        pickerStyles +
        buttonStyles +
        shellCollapseStyles +
        shellSectionStyles +
        shellProductStyles +
        shellProjectSwitchStyles +
        projectMenu.styles +
        bar.styles,
    });
  },
});
