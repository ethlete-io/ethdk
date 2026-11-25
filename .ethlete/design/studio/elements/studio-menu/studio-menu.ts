import { definePart, drawing, html, interactionRows } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import { action, type MenuInteraction, studioTrigger } from './shared/studio-menu-rows';
import anchoredDialog from '@system/components/anchored-dialog';
import menu from '@system/components/menu';
import logo, { studioBusyMark, studioMark } from '@system/foundations/logo';
import { setupStudioMenu } from './setup';
import styles from './studio-menu.css?inline';
import { DESIGN_SERVER_LABELS, STUDIO_MENU_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/shell-labels';

type Props = {
  open: boolean;
  server?: Server;
  submenu?: 'hover';
  interaction?: MenuInteraction;
  option?: MenuInteraction;
  busy?: boolean;
};

type Server = 'running' | 'stale' | 'stopped';

const SERVER_ACTION = ' data-et-action="emit:serverAction"';
const RELOAD_ACTION = ' data-et-action="emit:reload"';

const RESTART = { name: 'restart', label: DESIGN_SERVER_LABELS.restart, declared: SERVER_ACTION };

const SERVER_ACTIONS: Record<Server, { name: string; label: string; declared: string }[]> = {
  running: [
    { name: 'reload', label: STUDIO_MENU_LABELS.reload, declared: RELOAD_ACTION },
    RESTART,
    { name: 'stop', label: DESIGN_SERVER_LABELS.stop, declared: SERVER_ACTION },
  ],
  stale: [
    RESTART,
    { name: 'reload', label: STUDIO_MENU_LABELS.reload, declared: RELOAD_ACTION },
    { name: 'stop', label: DESIGN_SERVER_LABELS.stop, declared: SERVER_ACTION },
  ],
  stopped: [{ name: 'start', label: DESIGN_SERVER_LABELS.start, declared: SERVER_ACTION }],
};

const SERVER_SUBMENU_STATE: Record<Server, string> = {
  running: 'studio-menu.server',
  stale: 'studio-menu.stale',
  stopped: 'studio-menu.stopped',
};

const SERVER_SUBMENU_ID = 'studio-server-menu';

const serverStatusOf = (server: Server) =>
  `${STUDIO_MENU_LABELS.designServer} · ${STUDIO_MENU_LABELS.serverStatus[server]}`;

const serverTrigger = (server: Server, submenu: boolean, busy: boolean): MenuMockRow => ({
  label: serverStatusOf(server),
  submenu: submenu ? 'open' : true,
  active: submenu,
  activeSource: submenu ? 'pointer' : undefined,
  attributes: `data-studio-submenu-trigger data-et-slot="components/menu" data-et-action="${busy ? 'studio-menu.busy-server' : SERVER_SUBMENU_STATE[server]}"${submenu ? ' data-et-force="hover"' : ''}`,
});

const serverRows = (server: Server, busy: boolean): MenuMockRow[] =>
  SERVER_ACTIONS[server].map(({ name, label, declared }) => ({
    label,
    disabled: busy && name !== 'reload',
    attributes: `${action(name)}${declared}`,
  }));

const HELP_ROWS = [
  {
    name: 'shortcuts',
    label: STUDIO_MENU_LABELS.shortcuts,
    declared: 'data-et-action="opens:components/shortcuts-dialog"',
  },
  { name: 'help', label: STUDIO_MENU_LABELS.help, declared: 'data-et-action="emit:openHelp"' },
  { name: 'about', label: STUDIO_MENU_LABELS.about, declared: 'data-et-action="opens:components/about-dialog"' },
];

const REPOS = ['ethlete-sdk', 'fut-frontend', 'design-playground'];

const optionAttributes = (base: string, option?: MenuInteraction) =>
  option ? `${base} data-et-force="${option}"` : base;

const studioRows = (
  server: Server,
  submenu: boolean,
  busy: boolean,
  option?: MenuInteraction,
  keyboard = false,
): MenuMockRow[] => [
  {
    kind: 'radio-group',
    label: STUDIO_MENU_LABELS.project,
    items: REPOS.map((repo, index) => {
      const forced = index === 1 ? option : index === 0 && keyboard ? 'focus-visible' : undefined;

      return {
        kind: 'radio' as const,
        label: repo,
        checked: index === 0,
        disabled: busy && index !== 0,
        active: !!forced,
        activeSource: forced === 'focus-visible' ? ('keyboard' as const) : undefined,
        attributes: optionAttributes(
          index === 0
            ? `${action('project')} data-et-action="${busy ? 'studio-menu.busy' : 'closed'}"`
            : `${action('project')} data-et-action="emit:projectChange"`,
          forced,
        ),
      };
    }),
  },
  { kind: 'separator' },
  {
    label: STUDIO_MENU_LABELS.openProject,
    disabled: busy,
    attributes: `${action('open-project')} data-et-action="emit:openProject"`,
  },
  {
    label: STUDIO_MENU_LABELS.scan,
    disabled: busy,
    attributes: `${action('scan')} data-et-action="emit:scanProjects"`,
  },
  serverTrigger(server, submenu, busy),
  { kind: 'separator' },
  {
    label: STUDIO_MENU_LABELS.removeProject,
    disabled: busy,
    destructive: true,
    attributes: `${action('remove-project')} data-et-action="emit:removeProject"`,
  },
  { kind: 'separator' },
  ...HELP_ROWS.map(({ name, label, declared }) => ({
    label,
    attributes: `${action(name)} ${declared}`,
  })),
];

const studioPanel = async (
  server: Server,
  submenu: boolean,
  busy: boolean,
  interaction?: MenuInteraction,
  option?: MenuInteraction,
) => {
  const panel = await menu.render({
    rows: studioRows(server, submenu, busy, option, interaction === 'focus-visible'),
    forced: interaction === 'focus-visible' ? undefined : interaction,
  });

  return {
    body: panel.body.replace(/et-color--inherited"( data-variant="destructive")/gu, 'et-color--danger"$1'),
    styles: panel.styles,
  };
};

const serverPanel = async (server: Server, busy: boolean) => {
  const panel = await menu.render({ rows: serverRows(server, busy) });

  return {
    body: panel.body
      .replace(/^<et-menu id="[^"]*"/u, `<et-menu id="${SERVER_SUBMENU_ID}"`)
      .replace(' role="menu"', ` role="menu" aria-label="${STUDIO_MENU_LABELS.designServer}"`),
    styles: panel.styles,
  };
};

const busyTrigger = (trigger: string) =>
  trigger.replace(/^<button /, '<button aria-busy="true" ').replace(studioMark(40), studioBusyMark(40));

export const studioMenu = async ({ open, server = 'running', submenu, interaction, option, busy = false }: Props) => {
  const drawn = typeof location !== 'undefined';
  const panel = drawn
    ? await studioPanel(server, open && !!submenu, busy, open ? interaction : undefined, open ? option : undefined)
    : { body: '', styles: '' };
  const sub = drawn && open && submenu ? await serverPanel(server, busy) : { body: '', styles: '' };
  const arrow = drawn
    ? await anchoredDialog.render({ content: '', placement: 'bottom-start', modal: false })
    : { body: '', styles: '' };
  const arrowMarkup = (arrow.body.match(/<div class="et-overlay-arrow"[^>]*><\/div>/u)?.[0] ?? '').replace(
    'et-overlay-arrow',
    'et-overlay-arrow st-studio-menu-arrow',
  );
  const target = busy ? (open ? 'studio-menu.busy' : 'studio-menu.busy-open') : undefined;
  const trigger = studioTrigger(open, open ? undefined : interaction, target);
  return {
    body: html`<div class="relative size-10" data-studio-menu-root>
      ${busy ? busyTrigger(trigger) : trigger}
      <div
        id="studio-menu-surface"
        class="st-studio-menu absolute top-0 left-14 z-20 w-62"
        data-overlay-placement="right-start"
        data-studio-menu
        data-et-surface="studio-menu.open"
        ${open ? '' : ' hidden'}
      >
        ${panel.body} ${arrowMarkup}
        <div class="absolute left-full z-30 w-62" data-studio-submenu ${sub.body ? '' : ' hidden'}>${sub.body}</div>
      </div>
    </div>`,
    styles: arrow.styles + styles + logo.styles + buttonStyles + panel.styles + sub.styles,
    setup: setupStudioMenu,
  };
};

const menuRows = interactionRows<Props, 'closed' | 'open', MenuInteraction>(
  { closed: { open: false }, open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'Studio-wide actions behind the neutral logo tile: the project (repository) switch with the open one checked, Projekt öffnen…, Checkouts suchen… keeps every checkout with design work below the search folder, Projekt entfernen stops keeping the open project and shows the first one left (disabled while an action runs; the app also disables it when only one project is kept). The panel draws the SDK arrow toward the logo tile. The row Design-Server · <state> (läuft, veraltet, gestoppt) opens a submenu to its right with the rows the state allows: Neu laden, restart and stop while it runs (restart first and the label veraltet when the server runs an older cli build than the checkout), start while it is stopped. Neu laden stays enabled while an action runs. Below a separator Tastenkürzel opens components/shortcuts-dialog, Hilfe opens the Studio docs in the system browser and Über Studio opens components/about-dialog; they stay enabled while an action runs. Rows without a target (Erscheinungsbild, Einstellungen) stay hidden until a row builds their target (ADR 0337). The option states draw the second project. The element owns its trigger, SDK panel, styles, interaction states and prototype setup. Pages place its 40-px root in the shell rail slot. While a menu action runs (server start, restart or stop, project switch, Projekt öffnen…) the menu closes as usual and the tile is aria-busy and shows the mark with blinking eyes on the unchanged tile background instead of the static mark; reopened, every action row is disabled until the work answers.',
  madeBy: ['gpt-6', 'claude-opus-5-5', 'design check', 'claude-sonnet-5-5'],
  states: {
    ...menuRows.states,
    'studio-menu.server': { open: true, submenu: 'hover' },
    'studio-menu.stale': { open: true, server: 'stale', submenu: 'hover' },
    'studio-menu.stopped': { open: true, server: 'stopped', submenu: 'hover' },
    'studio-menu.option-hover': { open: true, option: 'hover' },
    'studio-menu.option-focus-visible': { open: true, option: 'focus-visible' },
    'studio-menu.option-active': { open: true, option: 'active' },
    'studio-menu.busy': { open: false, busy: true },
    'studio-menu.busy-open': { open: true, busy: true },
    'studio-menu.busy-server': { open: true, busy: true, submenu: 'hover' },
    'studio-menu.busy-focus-visible': { open: false, busy: true, interaction: 'focus-visible' },
    'studio-menu.busy-open-focus-visible': { open: true, busy: true, interaction: 'focus-visible' },
  },
  describe: {
    closed: 'The neutral logo tile with the menu closed; check that the tile shows no fill or ring and no menu shows.',
    'closed-hover': 'The logo tile hovered; check the hover fill on the tile only.',
    'closed-active': 'The logo tile pressed; check the darker press fill on the tile.',
    'closed-focus-visible': 'The logo tile focused by keyboard; check the focus ring around the tile, not clipped.',
    open: 'The open menu beside the tile; check Projekt with ethlete-sdk checked, then Projekt öffnen…, Checkouts suchen… and Design-Server · läuft with its arrow, Projekt entfernen in red, and Tastenkürzel, Hilfe and Über Studio, each group below a separator.',
    'open-hover': 'The open menu in its hover state; check that the menu keeps its place and the rows stay readable.',
    'open-active': 'The open menu in its press state; check that no row loses its label or check mark.',
    'open-focus-visible':
      'The menu opened by keyboard; check that the keyboard highlight sits on ethlete-sdk, the first row, and the tile shows no ring.',
    'studio-menu.server':
      'Design-Server · läuft opened as a submenu to the right of the menu; check its row stays highlighted and the submenu shows Neu laden, Design-Server neu starten and Design-Server stoppen.',
    'studio-menu.stale':
      'The submenu of a design server older than the checkout; check the row Design-Server · veraltet and Design-Server neu starten as the first submenu row.',
    'studio-menu.stopped':
      'The submenu of a stopped design server; check the row Design-Server · gestoppt and only Design-Server starten in the submenu.',
    'studio-menu.option-hover':
      'fut-frontend hovered; check that only that row is highlighted and ethlete-sdk keeps its check mark.',
    'studio-menu.option-focus-visible':
      'fut-frontend focused by keyboard; check its keyboard highlight and that ethlete-sdk keeps its check mark.',
    'studio-menu.option-active':
      'fut-frontend pressed; check its press highlight and that the other rows do not change.',
    'studio-menu.busy':
      'A menu action running (server start, project switch or open); check the tile keeps its rest background and only the mark blinks.',
    'studio-menu.busy-open':
      'The menu reopened while an action runs; check the blinking mark in the tile, every action row disabled and Tastenkürzel, Hilfe and Über Studio enabled.',
    'studio-menu.busy-server':
      'The server submenu while an action runs; check Neu laden enabled and the restart and stop rows disabled.',
    'studio-menu.busy-focus-visible':
      'The busy tile focused by keyboard after the menu closed; check the focus ring around the tile with the blinking mark inside.',
    'studio-menu.busy-open-focus-visible':
      'The busy menu opened by keyboard; check the keyboard highlight on ethlete-sdk, the only enabled project row, and the blinking mark in the tile.',
  },
  grid: menuRows.grid,
  controls: { 'studio-menu': { kind: 'menu', input: ['pointer', 'keyboard'], surfaces: { open: 'open' } } },
  styles: styles + logo.styles + buttonStyles,
  implements: 'apps/ethlete-studio/src/app/design-parts/studio-menu/studio-menu.component.ts',
  render: async (props: Props) => {
    const menu = await studioMenu(props);
    return drawing({
      body: html`<div class="box-border w-3xl h-120 p-space-3 text-et-surface font-ui text-ui-md">${menu.body}</div>`,
      setup: menu.setup,
      styles: menu.styles,
    });
  },
});
