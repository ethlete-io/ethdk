import { definePart, drawing, html, interactionRows } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import { action, type MenuInteraction, studioTrigger } from './shared/studio-menu-rows';
import menu from '@system/components/menu';
import { setupStudioMenu } from './setup';
import styles from './studio-menu.css?inline';

type Props = {
  open: boolean;
  server?: Server;
  appearance?: boolean;
  help?: boolean;
  interaction?: MenuInteraction;
  option?: MenuInteraction;
};

type Server = 'running' | 'stopped';

const SERVER_ACTIONS: Record<Server, { name: string; label: string }[]> = {
  running: [
    { name: 'restart', label: 'Design-Server neu starten' },
    { name: 'stop', label: 'Design-Server stoppen' },
  ],
  stopped: [{ name: 'start', label: 'Design-Server starten' }],
};

const serverRows = (server: Server): MenuMockRow[] => [
  { kind: 'label', label: 'Design-Server' },
  ...SERVER_ACTIONS[server].map(({ name, label }) => ({
    label,
    attributes: `${action(name)} data-et-action="emit:serverAction"`,
  })),
];

const APPEARANCES = ['Hell', 'Dunkel', 'Wie System'];

const REPOS = ['ethlete-sdk', 'fut-frontend', 'design-playground'];

const optionAttributes = (base: string, option?: MenuInteraction) =>
  option ? `${base} data-et-force="${option}"` : base;

const studioRows = (server: Server, appearance: boolean, help: boolean, option?: MenuInteraction): MenuMockRow[] => [
  {
    kind: 'radio-group',
    label: 'Projekt',
    items: REPOS.map((repo, index) => ({
      kind: 'radio' as const,
      label: repo,
      checked: index === 0,
      active: index === 1 && !!option,
      activeSource: index === 1 && option === 'focus-visible' ? ('keyboard' as const) : undefined,
      attributes: optionAttributes(
        index === 0
          ? `${action('project')} data-et-action="closed"`
          : `${action('project')} data-et-action="emit:projectChange"`,
        index === 1 ? option : undefined,
      ),
    })),
  },
  { label: 'Projekt öffnen…', attributes: `${action('open-project')} data-et-action="emit:openProject"` },
  { kind: 'separator' },
  ...serverRows(server),
  { kind: 'separator' },
  {
    label: 'Erscheinungsbild',
    submenu: appearance ? 'open' : true,
    active: appearance,
    attributes: 'data-et-slot="components/menu" data-et-action="studio-menu.appearance"',
  },
  {
    label: 'Hilfe & Einstellungen',
    submenu: help ? 'open' : true,
    active: help,
    attributes: 'data-et-slot="components/menu" data-et-action="studio-menu.help"',
  },
];

const helpRows: MenuMockRow[] = [
  {
    label: 'Einstellungen…',
    shortcut: 'Ctrl ,',
    attributes: `${action('settings')} data-et-action="emit:openSettings"`,
  },
  {
    label: 'Tastenkürzel…',
    shortcut: 'Ctrl /',
    attributes: `${action('shortcuts')} data-et-action="emit:openShortcuts"`,
  },
  { label: 'Hilfe', attributes: `${action('help')} data-et-action="emit:openHelp"` },
  { label: 'Über Studio…', attributes: `${action('about')} data-et-action="emit:openAbout"` },
];

const appearanceRows: MenuMockRow[] = [
  {
    kind: 'radio-group',
    items: APPEARANCES.map((label, index) => ({
      kind: 'radio' as const,
      label,
      checked: index === 1,
      attributes: `${action('appearance')} data-et-action="emit:appearanceChange"`,
    })),
  },
];

const studioPanel = (
  server: Server,
  appearance: boolean,
  help: boolean,
  interaction?: MenuInteraction,
  option?: MenuInteraction,
) => menu.render({ rows: studioRows(server, appearance, help, option), forced: interaction });

export const studioMenu = async ({
  open,
  server = 'running',
  appearance = false,
  help = false,
  interaction,
  option,
}: Props) => {
  const panel =
    typeof location === 'undefined'
      ? { body: '', styles: '' }
      : await studioPanel(
          server,
          open && appearance,
          open && help,
          open ? interaction : undefined,
          open ? option : undefined,
        );
  const submenu =
    open && appearance && typeof location !== 'undefined' ? await menu.render({ rows: appearanceRows }) : null;
  const helpMenu = open && help && typeof location !== 'undefined' ? await menu.render({ rows: helpRows }) : null;
  return {
    body: html`<div class="relative size-10" data-studio-menu-root>
      ${studioTrigger(open, open ? undefined : interaction)}
      <div
        id="studio-menu-surface"
        class="st-studio-menu absolute top-0 left-15 z-20 w-62"
        data-studio-menu
        data-et-surface="studio-menu.open"
        ${open ? '' : ' hidden'}
      >
        ${panel.body}
        ${
          submenu
            ? html`<div class="st-studio-submenu absolute w-44" data-et-surface="studio-menu.appearance">
                ${submenu.body}
              </div>`
            : ''
        }
        ${
          helpMenu
            ? html`<div class="st-studio-submenu st-studio-help absolute w-56" data-et-surface="studio-menu.help">
                ${helpMenu.body}
              </div>`
            : ''
        }
      </div>
    </div>`,
    styles: styles + buttonStyles + panel.styles + (submenu?.styles ?? '') + (helpMenu?.styles ?? ''),
    setup: setupStudioMenu,
  };
};

const menuRows = interactionRows<Props, 'closed' | 'open', MenuInteraction>(
  { closed: { open: false }, open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'Studio-wide actions behind the neutral logo tile: the project (repository) switch with the open one checked, Projekt öffnen…, the design server actions the server state allows (restart and stop while it runs, start while it is stopped), then Erscheinungsbild as a submenu with Hell, Dunkel and Wie System (studio-menu.appearance) and Hilfe & Einstellungen as a submenu with Einstellungen…, Tastenkürzel…, Hilfe and Über Studio… (studio-menu.help). An entry ending in … opens a dialog; Hilfe opens the documentation in the browser. The option states draw the second project. The element owns its trigger, SDK panel, styles, interaction states and prototype setup. Pages place its 40-px root in the shell rail slot.',
  madeBy: ['gpt-6', 'claude-opus-5-5'],
  states: {
    ...menuRows.states,
    'studio-menu.stopped': { open: true, server: 'stopped' },
    'studio-menu.appearance': { open: true, appearance: true },
    'studio-menu.help': { open: true, help: true },
    'studio-menu.option-hover': { open: true, option: 'hover' },
    'studio-menu.option-focus-visible': { open: true, option: 'focus-visible' },
    'studio-menu.option-active': { open: true, option: 'active' },
  },
  describe: {
    closed: 'The neutral logo tile with the menu closed; check that the tile shows no fill or ring and no menu shows.',
    'closed-hover': 'The logo tile hovered; check the hover fill on the tile only.',
    'closed-active': 'The logo tile pressed; check the darker press fill on the tile.',
    'closed-focus-visible': 'The logo tile focused by keyboard; check the focus ring around the tile, not clipped.',
    open: 'The open menu beside the tile; check Projekt with ethlete-sdk checked, Projekt öffnen…, the server actions and both submenu rows.',
    'open-hover': 'The open menu in its hover state; check that the menu keeps its place and the rows stay readable.',
    'open-active': 'The open menu in its press state; check that no row loses its label or check mark.',
    'open-focus-visible':
      'The menu opened by keyboard; check that the keyboard highlight sits inside the menu and the tile shows no ring.',
    'studio-menu.stopped':
      'The menu with the design server stopped; check that only Design-Server starten shows under Design-Server.',
    'studio-menu.appearance':
      'The Erscheinungsbild submenu open; check Hell, Dunkel and Wie System with Dunkel checked, beside its highlighted row.',
    'studio-menu.help':
      'The Hilfe & Einstellungen submenu open; check the four rows and the Ctrl , and Ctrl / shortcuts aligned right.',
    'studio-menu.option-hover':
      'fut-frontend hovered; check that only that row is highlighted and ethlete-sdk keeps its check mark.',
    'studio-menu.option-focus-visible':
      'fut-frontend focused by keyboard; check its keyboard highlight and that ethlete-sdk keeps its check mark.',
    'studio-menu.option-active':
      'fut-frontend pressed; check its press highlight and that the other rows do not change.',
  },
  grid: menuRows.grid,
  controls: { 'studio-menu': { kind: 'menu', input: ['pointer', 'keyboard'], surfaces: { open: 'open' } } },
  styles: styles + buttonStyles,
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
