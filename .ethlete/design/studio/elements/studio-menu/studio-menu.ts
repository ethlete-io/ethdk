import { definePart, drawing, html, interactionRows } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import { action, type MenuInteraction, studioTrigger } from './shared/studio-menu-rows';
import { loaderStyles, spinner } from '@ethlete/components/design/loader';
import menu from '@system/components/menu';
import { studioMark } from '@system/foundations/logo';
import { setupStudioMenu } from './setup';
import styles from './studio-menu.css?inline';

type Props = {
  open: boolean;
  server?: Server;
  interaction?: MenuInteraction;
  option?: MenuInteraction;
  busy?: boolean;
};

type Server = 'running' | 'stopped';

const SERVER_ACTIONS: Record<Server, { name: string; label: string }[]> = {
  running: [
    { name: 'restart', label: 'Design-Server neu starten' },
    { name: 'stop', label: 'Design-Server stoppen' },
  ],
  stopped: [{ name: 'start', label: 'Design-Server starten' }],
};

const serverRows = (server: Server, busy: boolean): MenuMockRow[] => [
  { kind: 'label', label: 'Design-Server' },
  ...SERVER_ACTIONS[server].map(({ name, label }) => ({
    label,
    disabled: busy,
    attributes: `${action(name)} data-et-action="emit:serverAction"`,
  })),
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
    label: 'Projekt öffnen…',
    disabled: busy,
    attributes: `${action('open-project')} data-et-action="emit:openProject"`,
  },
  { kind: 'separator' },
  ...serverRows(server, busy),
];

const studioPanel = (server: Server, busy: boolean, interaction?: MenuInteraction, option?: MenuInteraction) =>
  menu.render({
    rows: studioRows(server, busy, option, interaction === 'focus-visible'),
    forced: interaction === 'focus-visible' ? undefined : interaction,
  });

const busyTrigger = (trigger: string) =>
  trigger
    .replace(/^<button /, '<button aria-busy="true" ')
    .replace(
      studioMark(40),
      `<span class="flex size-10 items-center justify-center text-et-surface">${spinner()}</span>`,
    );

export const studioMenu = async ({ open, server = 'running', interaction, option, busy = false }: Props) => {
  const panel =
    typeof location === 'undefined'
      ? { body: '', styles: '' }
      : await studioPanel(server, busy, open ? interaction : undefined, open ? option : undefined);
  const target = busy ? (open ? 'studio-menu.busy' : 'studio-menu.busy-open') : undefined;
  const trigger = studioTrigger(open, open ? undefined : interaction, target);
  return {
    body: html`<div class="relative size-10" data-studio-menu-root>
      ${busy ? busyTrigger(trigger) : trigger}
      <div
        id="studio-menu-surface"
        class="st-studio-menu absolute top-0 left-15 z-20 w-62"
        data-studio-menu
        data-et-surface="studio-menu.open"
        ${open ? '' : ' hidden'}
      >
        ${panel.body}
      </div>
    </div>`,
    styles: styles + buttonStyles + loaderStyles + panel.styles,
    setup: setupStudioMenu,
  };
};

const menuRows = interactionRows<Props, 'closed' | 'open', MenuInteraction>(
  { closed: { open: false }, open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'Studio-wide actions behind the neutral logo tile: the project (repository) switch with the open one checked, Projekt öffnen…, the design server actions the server state allows (restart and stop while it runs, start while it is stopped). Rows without a target (Erscheinungsbild, Einstellungen, Tastenkürzel, Hilfe, Über Studio) stay hidden until a row builds their target (ADR 0337). The option states draw the second project. The element owns its trigger, SDK panel, styles, interaction states and prototype setup. Pages place its 40-px root in the shell rail slot. While a menu action runs (server start, restart or stop, project switch, Projekt öffnen…) the menu closes as usual and the tile is aria-busy and shows the SDK spinner instead of the mark; reopened, every action row is disabled until the work answers.',
  madeBy: ['gpt-6', 'claude-opus-5-5', 'design check'],
  states: {
    ...menuRows.states,
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
    open: 'The open menu beside the tile; check Projekt with ethlete-sdk checked, Projekt öffnen…, and the server actions, with no row below them.',
    'open-hover': 'The open menu in its hover state; check that the menu keeps its place and the rows stay readable.',
    'open-active': 'The open menu in its press state; check that no row loses its label or check mark.',
    'open-focus-visible':
      'The menu opened by keyboard; check that the keyboard highlight sits on ethlete-sdk, the first row, and the tile shows no ring.',
    'studio-menu.stopped':
      'The menu with the design server stopped; check that only Design-Server starten shows under Design-Server.',
    'studio-menu.option-hover':
      'fut-frontend hovered; check that only that row is highlighted and ethlete-sdk keeps its check mark.',
    'studio-menu.option-focus-visible':
      'fut-frontend focused by keyboard; check its keyboard highlight and that ethlete-sdk keeps its check mark.',
    'studio-menu.option-active':
      'fut-frontend pressed; check its press highlight and that the other rows do not change.',
    'studio-menu.busy':
      'A menu action running (server start, project switch or open); check the SDK spinner in the tile instead of the mark.',
    'studio-menu.busy-open':
      'The menu reopened while an action runs; check the spinner in the tile and that every action row is disabled.',
    'studio-menu.busy-focus-visible':
      'The busy tile focused by keyboard after the menu closed; check the focus ring around the tile with the spinner inside.',
    'studio-menu.busy-open-focus-visible':
      'The busy menu opened by keyboard; check the keyboard highlight on ethlete-sdk, the only enabled row, and the spinner in the tile.',
  },
  grid: menuRows.grid,
  controls: { 'studio-menu': { kind: 'menu', input: ['pointer', 'keyboard'], surfaces: { open: 'open' } } },
  styles: styles + buttonStyles + loaderStyles,
  implements: 'apps/ethlete-studio/src/app/design-parts/studio-menu/studio-menu.component.ts',
  render: async (props: Props) => {
    const menu = await studioMenu(props);
    return drawing({
      body: html`<div class="box-border w-3xl h-100 p-space-3 text-et-surface font-ui text-ui-md">${menu.body}</div>`,
      setup: menu.setup,
      styles: menu.styles,
    });
  },
});
