import { drawing, forceInteraction, html, interactionRows, slot, type Interaction, withAction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import { control } from '@ethlete/components/design/control';
import { shellCollapseStyles } from '@system/components/shell-collapse';
import titleBar from '@system/components/title-bar';
import { icon, type IconName } from '@system/foundations/icons';

type Section = 'System' | 'Sketches' | 'Flows' | 'Inbox';

export type SystemForce = string;

export type SystemChoice = (props: {
  product: string;
  products: string[];
  open: boolean;
  force?: SystemForce;
}) => Promise<{ head: string; top: string; surface: string; styles: string }>;

type Chrome = Pick<Parameters<typeof titleBar.render>[0], 'os' | 'left' | 'right'>;

const LINUX_CHROME: Chrome = { os: 'linux', left: [], right: ['minimize', 'maximize', 'close'] };

type Props = {
  section: Section;
  product: string;
  side: string;
  content: string;
  panel?: 'hidden';
  systemPicker?: 'open';
  systemForce?: SystemForce;
  studio?: string;
  force?: RailForce;
  server?: 'stopped' | 'starting' | 'unanswered';
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

const RAIL_CONTROLS: Record<RailKind, string> = { section: 'section', product: 'product' };

type RailInteraction = Exclude<Interaction, 'disabled'>;

type RailForce = { label: string; interaction: RailInteraction };

const HOVER_PRESS = 'hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15';

const HOVER_PRESS_RAISED =
  'hover:bg-linear-to-b hover:from-et-surface-interaction/9 hover:to-et-surface-interaction/9 active:bg-linear-to-b active:from-et-surface-interaction/15 active:to-et-surface-interaction/15';

const bubbleClass = (kind: RailKind, active: boolean, panelHidden: boolean) => {
  if (kind === 'section') {
    if (active && !panelHidden) return 'rounded-control-lg text-et-theme-ink bg-et-theme/20 hover:bg-et-theme/20';

    return `rounded-control-lg ${active ? 'text-et-theme-ink' : 'text-et-surface-muted'} ${HOVER_PRESS}`;
  }

  if (kind === 'product') {
    return `rounded-control-md bg-et-surface-bg ${active ? 'text-et-surface' : 'text-et-surface-muted'} ${HOVER_PRESS_RAISED}`;
  }

  return `rounded-control-md text-et-surface-muted ${HOVER_PRESS}`;
};

const railButton = (markup: string, label: string, force?: RailForce) =>
  force?.label === label ? forceInteraction(markup, force.interaction) : markup;

const RAIL_ACTIONS: Record<RailKind, string> = {
  section: 'emit:sectionChange',
  product: 'emit:productChange',
};

const railItem = (
  inner: string,
  label: string,
  active: boolean,
  kind: RailKind,
  panelHidden = false,
  force?: RailForce,
) =>
  `<div class="st-shell-slot relative flex justify-center w-full ${active ? `before:absolute before:left-0 ${kind === 'section' ? 'before:bg-et-theme' : 'before:bg-text'}` : ''}" data-kind="${kind}"${active ? ' data-active' : ''}>${control(
    railButton(
      `<button type="button"${kind === 'product' ? ' data-et-auto-surface' : ''} class="st-shell-bubble flex items-center justify-center p-0 text-ui-sm font-ui-strong ${bubbleClass(kind, active, panelHidden)}" aria-label="${label}" data-et-action="${kind === 'section' && active && !panelHidden ? 'emit:collapse' : RAIL_ACTIONS[kind]}"${active ? ` aria-current="${kind === 'section' ? 'page' : 'true'}"` : ''}>${inner}</button>`,
      label,
      force,
    ),
    RAIL_CONTROLS[kind],
  )}</div>`;

const sep = '<div class="st-shell-sep my-space-2 bg-et-surface-border"></div>';

const rail = (section: Section, product: string, panelHidden: boolean, studio: string, force?: RailForce) =>
  html`<nav class="st-shell-rail row-start-2 flex flex-col items-center gap-space-1 py-space-3 bg-et-surface-bg">
    <div class="st-shell-slot relative flex justify-center w-full min-h-10" data-kind="logo">${studio}</div>
    ${sep}
    ${SECTIONS.map((s) => railItem(icon(ICONS[s], { size: 20 }), s, s === section, 'section', panelHidden, force)).join('')}
    <div class="flex-1"></div>
    ${sep}
    ${RECENT_PRODUCTS.map((p) => railItem(p.charAt(0).toUpperCase(), p, p === product, 'product', false, force)).join('')}
  </nav>`;

const sidePanel = (side: string, head: string, top: string) =>
  html`<aside
    class="st-shell-side absolute top-space-3 bottom-space-3 left-space-3 flex flex-col min-h-0 overflow-hidden rounded-control-lg bg-et-surface-bg"
  >
    <header class="st-shell-side-head flex items-center justify-between gap-space-1 box-border pr-space-2 pl-space-2">
      ${head}
    </header>
    ${top}
    <div class="flex-1 min-h-0 overflow-hidden p-space-2">${side}</div>
  </aside>`;

const SERVER_LOG = [
  'vite v7.1.4 dev server running at http://localhost:4402/',
  'Error: EADDRINUSE: address already in use :::4402',
  'design server exited with code 1',
];

const restartButton = withAction(
  button({
    label: 'Neu starten',
    variant: 'outline',
    color: 'surface',
    size: 'sm',
  }).replace(/^<button /, '<button data-et-control="restart" '),
  'emit:restartServer',
);

const serverScreen = (server: 'stopped' | 'starting' | 'unanswered', log: string[]) =>
  html`<div class="box-border size-full overflow-auto pl-(--st-shell-inset-left)">
    ${
      server === 'starting' || server === 'unanswered'
        ? html`<div class="mx-auto mt-15 w-full max-w-6xl box-border px-space-5">
            <h3 class="m-0 text-ui-lg font-ui-strong text-et-surface">Design-Server startet</h3>
            ${
              server === 'unanswered'
                ? html`<p class="m-0 mt-space-2 text-ui-sm text-et-surface-muted">
                    Design-Server antwortet nicht: http://localhost:4402
                  </p>`
                : ''
            }
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

type SystemStates = Record<string, Pick<Props, 'systemPicker' | 'systemForce'>>;

export const shellMain = <const TStates extends SystemStates, TControl>(
  styles: string,
  choice: SystemChoice,
  system: { states: TStates; control: TControl },
) => ({
  widths: [1440],
  states: {
    'server-stopped': { ...BASE, server: 'stopped', log: SERVER_LOG },
    'server-starting': { ...BASE, server: 'starting' },
    'server-unanswered': { ...BASE, server: 'unanswered' },
    open: BASE,
    'open-focus-visible': { ...BASE, systemForce: 'focus-visible' },
    hidden: { ...BASE, panel: 'hidden' },
    ...sectionRows.states,
    ...productRows.states,
    ...(Object.fromEntries(Object.entries(system.states).map(([name, props]) => [name, { ...BASE, ...props }])) as {
      [K in keyof TStates]: Props;
    }),
  } satisfies Record<string, Props>,
  grid: { columns: sectionRows.grid.columns, rows: { ...sectionRows.grid.rows, ...productRows.grid.rows } },
  controls: {
    section: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
    product: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
    collapse: { kind: 'button' as const, part: 'components/shell-collapse' as const },
    restart: { kind: 'button' as const, part: 'components/button' as const },
    system: system.control,
  },
  render: async ({
    product,
    section,
    content,
    side,
    panel,
    systemPicker,
    systemForce,
    studio = '',
    force,
    server,
    log = [],
    chrome = LINUX_CHROME,
    update = false,
  }: Props) => {
    const bar = await titleBar.render({ ...chrome, update, product, part: '' });
    const system = await choice({
      product,
      products: RECENT_PRODUCTS,
      open: systemPicker === 'open',
      force: systemForce,
    });

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
          ${panel === 'hidden' ? '' : sidePanel(side, system.head, system.top)}
          ${panel === 'hidden' ? '' : system.surface}
        </div>
      </div>`,
      styles: styles + buttonStyles + shellCollapseStyles + system.styles + bar.styles,
    });
  },
});
