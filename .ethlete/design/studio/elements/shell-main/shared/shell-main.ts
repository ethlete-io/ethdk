import config from '../../../../config.json';
import { drawing, forceInteraction, html, interactionRows, slot, type Interaction, withAction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import { control } from '@ethlete/components/design/control';
import { tooltip, tooltipStyles } from '@ethlete/components/design/tooltip';
import { loaderStyles, spinner } from '@ethlete/components/design/loader';
import { shellCollapseStyles } from '@system/components/shell-collapse';
import { SIDE_WIDTH } from '@system/components/shell-resize-handle';
import titleBar from '@system/components/title-bar';
import { icon, type IconName } from '@system/foundations/icons';
import {
  DESIGN_SERVER_LABELS,
  STUDIO_MENU_LABELS,
} from '../../../../../../apps/ethlete-studio/src/app/i18n/shell-labels';

type Section = 'System' | 'Sketches' | 'Flows' | 'Inbox';

export type SystemChoice = (props: {
  product: string;
  products: string[];
  open: boolean;
}) => Promise<{ head: string; top: string; surface: string; styles: string }>;

type Chrome = Pick<Parameters<typeof titleBar.render>[0], 'os' | 'left' | 'right'>;

const LINUX_CHROME: Chrome = { os: 'linux', left: [], right: ['minimize', 'maximize', 'close'] };

type Crash = { time: string; pid: number; port: number; path: string; stack: string[] };

export type CrashScreen = (crash: Crash) => string;

type Props = {
  section: Section;
  product: string;
  side: string;
  content: string;
  panel?: 'hidden';
  systemPicker?: 'open';
  studio?: string;
  force?: RailForce;
  server?: 'stopped' | 'starting' | 'unanswered' | 'crashed';
  phase?: StartPhase;
  phaseMs?: number;
  log?: string[];
  crash?: Crash;
  serverUrl?: string;
  chrome?: Chrome;
  update?: boolean;
  sideWidth?: number;
  logos?: Record<string, string>;
};

type StartPhase = 'starting' | 'cli-build' | 'app-build';

const PHASE_HEADINGS: Record<StartPhase, string> = {
  starting: DESIGN_SERVER_LABELS.starting,
  'cli-build': DESIGN_SERVER_LABELS.startPhase['cli-build'],
  'app-build': DESIGN_SERVER_LABELS.startPhase['app-build'],
};

const elapsedLabel = (ms: number) => {
  const seconds = Math.floor(ms / 1000);

  return seconds < 60
    ? `seit ${seconds} s`
    : `seit ${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
};

const SECTIONS: Exclude<Section, 'Sketches'>[] = ['System', 'Flows', 'Inbox'];

const RECENT_PRODUCTS = ['studio', 'studio-lab', 'sdk', 'timetrack', 'docs'];

const railLetters = (names: string[]) => {
  const taken = new Set<string>();

  return names.map((name) => {
    const words = name.split('-').filter(Boolean);
    const chars = [...name.replace(/-/g, '')];
    const candidates = [
      ...(words.length > 1 ? [words.map((word) => word[0]).join('')] : []),
      ...chars.slice(1).map((char) => name.charAt(0) + char),
    ].map((letters) => letters.charAt(0).toUpperCase() + letters.slice(1));
    const letters: string = candidates.find((candidate) => !taken.has(candidate)) ?? name.charAt(0).toUpperCase();

    taken.add(letters);

    return letters;
  });
};

const RAIL_LETTERS = railLetters(RECENT_PRODUCTS);

const LOGO_FILES = import.meta.glob<string>(
  [
    '../../../../*/assets/*.{svg,png}',
    '../../../../../../apps/*/src-tauri/icons/*.png',
    '../../../../../../libs/*/assets/*.{svg,png}',
  ],
  { query: '?inline', import: 'default', eager: true },
);

const RAIL_LOGOS: Record<string, string> = Object.fromEntries(
  RECENT_PRODUCTS.flatMap((name) => {
    const logo = (config.products as Record<string, { logo?: string }>)[name]?.logo;
    const key = logo
      ? Object.keys(LOGO_FILES).find((candidate) => new URL(candidate, import.meta.url).pathname.endsWith(`/${logo}`))
      : undefined;
    const file = key ? LOGO_FILES[key] : undefined;

    return file ? [[name, file]] : [];
  }),
);

const railMark = (logos: Record<string, string>, product: string, index: number) =>
  logos[product]
    ? `<img src="${logos[product]}" alt="" class="block size-5 object-contain pointer-events-none">`
    : (RAIL_LETTERS[index] ?? product);

const ICONS: Record<(typeof SECTIONS)[number], IconName> = {
  System: 'grid',
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

const railButton = (markup: string, label: string, kind: RailKind, force?: RailForce) => {
  if (force?.label !== label) return control(markup, RAIL_CONTROLS[kind]);
  const forced = control(forceInteraction(markup, force.interaction), RAIL_CONTROLS[kind]);
  return kind === 'product'
    ? `<span class="relative inline-flex">${forced}<span class="absolute inset-y-0 left-full z-10 ml-2 flex w-max items-center pt-1">${tooltip({ text: label, placement: 'right', anchor: `[aria-label="${label}"]` })}</span></span>`
    : forced;
};

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
  current = active,
) =>
  `<div class="st-shell-slot relative flex justify-center w-full ${active ? `before:absolute before:left-0 ${kind === 'section' ? 'before:bg-et-theme' : 'before:bg-text'}` : ''}" data-kind="${kind}"${active ? ' data-active' : ''}>${railButton(
    `<button type="button"${kind === 'product' ? ' data-et-auto-surface' : ''} class="st-shell-bubble flex items-center justify-center p-0 text-ui-sm font-ui-strong ${bubbleClass(kind, active, panelHidden)}" aria-label="${label}" data-et-action="${kind === 'section' && current && !panelHidden ? 'emit:collapse' : RAIL_ACTIONS[kind]}"${active ? ` aria-current="${kind === 'section' ? 'page' : 'true'}"` : ''}>${inner}</button>`,
    label,
    kind,
    force,
  )}</div>`;

const sep = '<div class="st-shell-sep my-space-2 bg-et-surface-border"></div>';

const railSection = (section: Section) => (section === 'Sketches' ? 'System' : section);

const rail = (
  section: Section,
  product: string,
  panelHidden: boolean,
  studio: string,
  logos: Record<string, string>,
  force?: RailForce,
) =>
  html`<nav class="st-shell-rail row-start-2 flex flex-col items-center gap-space-1 py-space-3 bg-et-surface-bg">
    <div class="st-shell-slot relative flex justify-center w-full min-h-10" data-kind="logo">${studio}</div>
    ${sep}
    ${SECTIONS.map((s) => railItem(icon(ICONS[s], { size: 20 }), s, s === railSection(section), 'section', panelHidden, force, s === section)).join('')}
    <div class="flex-1"></div>
    ${sep}
    ${RECENT_PRODUCTS.map((p, index) => railItem(railMark(logos, p, index), p, p === product, 'product', false, force)).join('')}
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

const SERVER_CRASH: Crash = {
  time: '14.11.2026, 09:42:17',
  pid: 48213,
  port: 4402,
  path: '/srv/studio/.ethlete/cache/design-server-crash.log',
  stack: [
    "TypeError: Cannot read properties of undefined (reading 'states')",
    '    at renderPart (dist/libs/cli/src/lib/design/render.js:212:31)',
    '    at async serveFrame (dist/libs/cli/src/lib/design/serve.js:88:5)',
  ],
};

export const restartButton = withAction(
  button({
    label: DESIGN_SERVER_LABELS.restartButton,
    variant: 'outline',
    color: 'surface',
    size: 'sm',
  }).replace(/^<button /, '<button data-et-control="restart" '),
  'emit:restartServer',
);

const serverScreen = (
  server: NonNullable<Props['server']>,
  log: string[],
  serverUrl: string,
  crash: Crash,
  crashScreen: CrashScreen,
  phase: StartPhase,
  phaseMs: number,
) =>
  html`<div class="box-border size-full overflow-auto pl-(--st-shell-inset-left)">
    ${
      server === 'crashed'
        ? crashScreen(crash)
        : server === 'starting' || server === 'unanswered'
          ? html`<div
              class="mx-auto mt-15 w-full max-w-6xl box-border px-space-5"
              ${server === 'starting' ? 'aria-busy="true"' : ''}
            >
              ${
                server === 'starting'
                  ? html`<div class="flex items-center gap-space-2 text-et-surface">
                        ${spinner()}
                        <h3 class="m-0 text-ui-lg font-ui-strong">${PHASE_HEADINGS[phase]}</h3>
                      </div>
                      <p class="m-0 mt-space-1 text-ui-sm text-et-surface-muted">${elapsedLabel(phaseMs)}</p>`
                  : html`<h3 class="m-0 text-ui-lg font-ui-strong text-et-surface">${DESIGN_SERVER_LABELS.stopped}</h3>`
              }
              ${
                server === 'unanswered'
                  ? html`<p class="m-0 mt-space-2 text-ui-sm text-et-surface-muted">
                        ${STUDIO_MENU_LABELS.designServer} antwortet nicht: ${serverUrl}
                      </p>
                      <div class="mt-space-3">${restartButton}</div>`
                  : ''
              }
            </div>`
          : html`<div
              class="mx-auto mt-15 flex w-full max-w-6xl box-border flex-col items-start gap-space-3 px-space-5 text-ui-sm text-et-surface-muted"
              role="alert"
            >
              <h3 class="m-0 text-ui-lg font-ui-strong text-et-surface">${DESIGN_SERVER_LABELS.stopped}</h3>
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
  logos: RAIL_LOGOS,
};

const railRowsOf = <const TRow extends string>(row: TRow, label: string) =>
  interactionRows<Props, TRow, RailInteraction>({ [row]: BASE } as Record<TRow, Props>, {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props, interaction) => ({ ...props, force: { label, interaction } }),
  });

const sectionRows = railRowsOf('section', 'Flows');
const productRows = railRowsOf('product', 'timetrack');

type SystemStates = Record<string, Pick<Props, 'systemPicker'>>;

export const shellMain = <const TStates extends SystemStates, TControl>(
  styles: string,
  resizeHandle: (props: { width: number }) => string,
  choice: SystemChoice,
  system: { states: TStates; control: TControl },
  crashScreen: CrashScreen,
) => ({
  widths: [1440],
  states: {
    'server-stopped': { ...BASE, server: 'stopped', log: SERVER_LOG },
    'server-starting': { ...BASE, server: 'starting', phase: 'starting', phaseMs: 42_000 },
    'server-cli-build': { ...BASE, server: 'starting', phase: 'cli-build', phaseMs: 95_000 },
    'server-app-build': { ...BASE, server: 'starting', phase: 'app-build', phaseMs: 95_000 },
    'server-unanswered': { ...BASE, server: 'unanswered', serverUrl: 'http://localhost:4402' },
    'server-crashed': { ...BASE, server: 'crashed', crash: SERVER_CRASH },
    open: BASE,
    hidden: { ...BASE, panel: 'hidden' },
    ...sectionRows.states,
    ...productRows.states,
    resize: BASE,
    'resize-min': { ...BASE, sideWidth: SIDE_WIDTH.min },
    'resize-max': { ...BASE, sideWidth: SIDE_WIDTH.max },
    ...(Object.fromEntries(Object.entries(system.states).map(([name, props]) => [name, { ...BASE, ...props }])) as {
      [K in keyof TStates]: Props;
    }),
  } satisfies Record<string, Props>,
  grid: {
    columns: sectionRows.grid.columns,
    rows: { ...sectionRows.grid.rows, ...productRows.grid.rows },
  },
  controls: {
    section: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
    product: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
    resize: { kind: 'button' as const, part: 'components/shell-resize-handle' as const },
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
    studio = '',
    force,
    server,
    phase = 'starting',
    phaseMs = 0,
    log = [],
    serverUrl = '',
    crash = SERVER_CRASH,
    chrome = LINUX_CHROME,
    update = false,
    sideWidth,
    logos = RAIL_LOGOS,
  }: Props) => {
    const bar = await titleBar.render({ ...chrome, update, product, part: '' });
    const system = await choice({
      product,
      products: RECENT_PRODUCTS,
      open: systemPicker === 'open',
    });

    return drawing({
      body: html`<div
        class="st-shell relative grid overflow-hidden bg-et-surface-bg text-et-surface font-ui text-ui-md"
        data-et-surface
        data-floating${panel === 'hidden' ? ' data-panel="hidden"' : ''}${sideWidth ? ` style="--st-side-width: ${sideWidth}px"` : ''}
      >
        <div class="col-span-full">${bar.body}</div>
        ${rail(section, product, panel === 'hidden', studio, logos, force)}
        <div class="st-shell-stage relative row-start-2 min-w-0">
          <main
            class="st-shell-content absolute inset-0 min-w-0 overflow-hidden bg-et-surface-bg"
            ${server ? '' : slot('canvas')}
          >
            ${server ? serverScreen(server, log, serverUrl, crash, crashScreen, phase, phaseMs) : content}
          </main>
          ${panel === 'hidden' ? '' : sidePanel(side, system.head, system.top)}
          ${panel === 'hidden' ? '' : resizeHandle({ width: sideWidth ?? SIDE_WIDTH.rest })}
          ${panel === 'hidden' ? '' : system.surface}
        </div>
      </div>`,
      styles: styles + buttonStyles + loaderStyles + shellCollapseStyles + tooltipStyles + system.styles + bar.styles,
    });
  },
});
