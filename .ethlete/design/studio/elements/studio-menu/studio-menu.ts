import { definePart, drawing, html, interactionRows } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import { action, type MenuInteraction, studioTrigger } from './shared/studio-menu-rows';
import anchoredDialog from '@system/components/anchored-dialog';
import menu from '@system/components/menu';
import { studioMark } from '@system/foundations/logo';
import { setupStudioMenu } from './setup';
import styles from './studio-menu.css?inline';
import { DESIGN_SERVER_LABELS, STUDIO_MENU_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/shell-labels';

type Props = {
  open: boolean;
  server?: Server;
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

const SERVER_STATUS: Record<Server, string> = {
  running: 'Design-Server · läuft',
  stale: 'Design-Server · veraltet',
  stopped: 'Design-Server · gestoppt',
};

const serverRows = (server: Server, busy: boolean): MenuMockRow[] => [
  { kind: 'label', label: SERVER_STATUS[server] },
  ...SERVER_ACTIONS[server].map(({ name, label, declared }) => ({
    label,
    disabled: busy && name !== 'reload',
    attributes: `${action(name)}${declared}`,
  })),
];

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

const studioRows = (server: Server, busy: boolean, option?: MenuInteraction, keyboard = false): MenuMockRow[] => [
  {
    kind: 'radio-group',
    label: 'Projekt',
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
  {
    label: STUDIO_MENU_LABELS.removeProject,
    disabled: busy,
    attributes: `${action('remove-project')} data-et-action="emit:removeProject"`,
  },
  { kind: 'separator' },
  ...serverRows(server, busy),
  { kind: 'separator' },
  ...HELP_ROWS.map(({ name, label, declared }) => ({
    label,
    attributes: `${action(name)} ${declared}`,
  })),
];

const studioPanel = (server: Server, busy: boolean, interaction?: MenuInteraction, option?: MenuInteraction) =>
  menu.render({
    rows: studioRows(server, busy, option, interaction === 'focus-visible'),
    forced: interaction === 'focus-visible' ? undefined : interaction,
  });

const busyMark = `<svg data-et-drawing class="st-studio-busy block" width="40" height="40" viewBox="0 0 32 32" aria-hidden="true">
  <rect width="32" height="32" rx="8" fill="var(--st-tile)" />
  <g class="st-studio-busy-bubble" color="var(--st-on-tile)">
    <path fill="currentColor" d="M11.5 5.5H24.1C26 5.5 27 6.9 26.4 8.7L22.8 20.9C22.5 22 21.8 22.9 20.8 23.4L8 28L9 21.6L5.9 17.4C5.2 16.5 5.2 15.2 5.9 14.2L9.4 6.8C9.8 6 10.6 5.5 11.5 5.5Z" />
    <path class="st-studio-busy-eye" fill="var(--st-tile)" d="M12.8 11.5C12 11.3 11.2 11.8 11 12.6L10.2 15.7C10 16.5 10.5 17.3 11.3 17.5C12.1 17.7 12.9 17.2 13.1 16.4L13.9 13.3C14.1 12.5 13.6 11.7 12.8 11.5Z" />
    <path class="st-studio-busy-eye" fill="var(--st-tile)" d="M20.1 10.6C19.3 10.4 18.5 10.9 18.3 11.7L17.5 14.8C17.3 15.6 17.8 16.4 18.6 16.6C19.4 16.8 20.2 16.3 20.4 15.5L21.2 12.4C21.4 11.6 20.9 10.8 20.1 10.6Z" />
  </g>
</svg>`;

const busyTrigger = (trigger: string) =>
  trigger.replace(/^<button /, '<button aria-busy="true" ').replace(studioMark(40), busyMark);

export const studioMenu = async ({ open, server = 'running', interaction, option, busy = false }: Props) => {
  const panel =
    typeof location === 'undefined'
      ? { body: '', styles: '' }
      : await studioPanel(server, busy, open ? interaction : undefined, open ? option : undefined);
  const arrow =
    typeof location === 'undefined'
      ? { body: '', styles: '' }
      : await anchoredDialog.render({ content: '', placement: 'bottom-start', modal: false });
  const arrowMarkup = (arrow.body.match(/<div class="et-overlay-arrow"[^>]*><\/div>/u)?.[0] ?? '').replace(
    '<div ',
    '<div style="top: 10px; --et-surface-background-solid: initial; --_et-overlay-arrow-pane-border-width: 1px; --_et-overlay-arrow-pane-border-color: rgb(56 56 56)" ',
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
      </div>
    </div>`,
    styles: arrow.styles + styles + buttonStyles + panel.styles,
    setup: setupStudioMenu,
  };
};

const menuRows = interactionRows<Props, 'closed' | 'open', MenuInteraction>(
  { closed: { open: false }, open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'Studio-wide actions behind the neutral logo tile: the project (repository) switch with the open one checked, Projekt öffnen…, Checkouts suchen… keeps every checkout with design work below the search folder, Projekt entfernen stops keeping the open project and shows the first one left (disabled while an action runs; the app also disables it when only one project is kept). The panel draws the SDK arrow toward the logo tile. The Design-Server label names the state (läuft, veraltet, gestoppt) and the rows the state allows: Neu laden, restart and stop while it runs (restart first and the label veraltet when the server runs an older cli build than the checkout), start while it is stopped. Neu laden stays enabled while an action runs. Below a separator Tastenkürzel opens components/shortcuts-dialog, Hilfe opens the Studio docs in the system browser and Über Studio opens components/about-dialog; they stay enabled while an action runs. Rows without a target (Erscheinungsbild, Einstellungen) stay hidden until a row builds their target (ADR 0337). The option states draw the second project. The element owns its trigger, SDK panel, styles, interaction states and prototype setup. Pages place its 40-px root in the shell rail slot. While a menu action runs (server start, restart or stop, project switch, Projekt öffnen…) the menu closes as usual and the tile is aria-busy and shows the mark with blinking eyes on the unchanged tile background instead of the static mark; reopened, every action row is disabled until the work answers.',
  madeBy: ['gpt-6', 'claude-opus-5-5', 'design check', 'claude-sonnet-5-5'],
  states: {
    ...menuRows.states,
    'studio-menu.stale': { open: true, server: 'stale' },
    'studio-menu.stopped': { open: true, server: 'stopped' },
    'studio-menu.option-hover': { open: true, option: 'hover' },
    'studio-menu.option-focus-visible': { open: true, option: 'focus-visible' },
    'studio-menu.option-active': { open: true, option: 'active' },
    'studio-menu.busy': { open: false, busy: true },
    'studio-menu.busy-open': { open: true, busy: true },
    'studio-menu.busy-focus-visible': { open: false, busy: true, interaction: 'focus-visible' },
    'studio-menu.busy-open-focus-visible': { open: true, busy: true, interaction: 'focus-visible' },
  },
  describe: {
    closed: 'The neutral logo tile with the menu closed; check that the tile shows no fill or ring and no menu shows.',
    'closed-hover': 'The logo tile hovered; check the hover fill on the tile only.',
    'closed-active': 'The logo tile pressed; check the darker press fill on the tile.',
    'closed-focus-visible': 'The logo tile focused by keyboard; check the focus ring around the tile, not clipped.',
    open: 'The open menu beside the tile; check Projekt with ethlete-sdk checked, Projekt öffnen…, the server actions, and Tastenkürzel, Hilfe and Über Studio below a separator.',
    'open-hover': 'The open menu in its hover state; check that the menu keeps its place and the rows stay readable.',
    'open-active': 'The open menu in its press state; check that no row loses its label or check mark.',
    'open-focus-visible':
      'The menu opened by keyboard; check that the keyboard highlight sits on ethlete-sdk, the first row, and the tile shows no ring.',
    'studio-menu.stale':
      'The menu with a design server older than the checkout; check the label Design-Server · veraltet and Design-Server neu starten as the first row under it.',
    'studio-menu.stopped':
      'The menu with the design server stopped; check that only Design-Server starten shows under Design-Server.',
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
    'studio-menu.busy-focus-visible':
      'The busy tile focused by keyboard after the menu closed; check the focus ring around the tile with the blinking mark inside.',
    'studio-menu.busy-open-focus-visible':
      'The busy menu opened by keyboard; check the keyboard highlight on ethlete-sdk, the only enabled project row, and the blinking mark in the tile.',
  },
  grid: menuRows.grid,
  controls: { 'studio-menu': { kind: 'menu', input: ['pointer', 'keyboard'], surfaces: { open: 'open' } } },
  styles: styles + buttonStyles,
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
