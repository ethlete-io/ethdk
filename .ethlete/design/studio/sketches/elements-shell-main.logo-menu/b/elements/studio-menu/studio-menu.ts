import { definePart, drawing, html, interactionRows } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import { action, type MenuInteraction, type Server, serverRows, studioTrigger } from '@shared/studio-menu-rows';
import menu from '@system/components/menu';
import { setupStudioMenu } from './setup';
import styles from './studio-menu.css?inline';

type Props = {
  open: boolean;
  server?: Server;
  projects?: boolean;
  appearance?: boolean;
  interaction?: MenuInteraction;
  option?: MenuInteraction;
};

const APPEARANCES = ['Hell', 'Dunkel', 'Wie System'];

const REPOS = ['ethlete-sdk', 'fut-frontend', 'design-playground'];

const studioRows = (
  server: Server,
  projects: boolean,
  appearance: boolean,
  option?: MenuInteraction,
): MenuMockRow[] => [
  { kind: 'label', label: 'Projekt' },
  {
    label: REPOS[0] ?? '',
    submenu: projects ? 'open' : true,
    active: projects || !!option,
    ...(option === 'focus-visible' ? { activeSource: 'keyboard' as const } : {}),
    attributes: `data-et-slot="components/menu" data-et-action="studio-menu.projects"${option ? ` data-et-force="${option}"` : ''}`,
  },
  { label: 'Projekt öffnen…', attributes: action('open-project', 'emit:openProject') },
  { kind: 'separator' },
  ...serverRows(server),
  { kind: 'separator' },
  { label: 'Einstellungen…', shortcut: 'Ctrl ,', attributes: action('settings', 'emit:openSettings') },
  {
    label: 'Erscheinungsbild',
    submenu: appearance ? 'open' : true,
    active: appearance,
    attributes: 'data-et-slot="components/menu" data-et-action="studio-menu.appearance"',
  },
  { label: 'Tastenkürzel…', shortcut: 'Ctrl /', attributes: action('shortcuts', 'emit:openShortcuts') },
  { label: 'Hilfe', attributes: action('help', 'emit:openHelp') },
  { label: 'Über Studio…', attributes: action('about', 'emit:openAbout') },
];

const appearanceRows: MenuMockRow[] = [
  {
    kind: 'radio-group',
    items: APPEARANCES.map((label, index) => ({
      kind: 'radio' as const,
      label,
      checked: index === 1,
      attributes: action('appearance', 'emit:appearanceChange'),
    })),
  },
];

const projectRows: MenuMockRow[] = [
  {
    kind: 'radio-group',
    items: REPOS.map((repo, index) => ({
      kind: 'radio' as const,
      label: repo,
      checked: index === 0,
      attributes: index === 0 ? action('project', 'closed') : action('project', 'emit:projectChange'),
    })),
  },
];

const studioPanel = (
  server: Server,
  projects: boolean,
  appearance: boolean,
  interaction?: MenuInteraction,
  option?: MenuInteraction,
) => menu.render({ rows: studioRows(server, projects, appearance, option), forced: interaction });

export const studioMenu = async ({
  open,
  server = 'running',
  projects = false,
  appearance = false,
  interaction,
  option,
}: Props) => {
  const panel =
    typeof location === 'undefined'
      ? { body: '', styles: '' }
      : await studioPanel(
          server,
          open && projects,
          open && appearance,
          open ? interaction : undefined,
          open ? option : undefined,
        );
  const submenu =
    open && appearance && typeof location !== 'undefined' ? await menu.render({ rows: appearanceRows }) : null;
  const projectMenu =
    open && projects && typeof location !== 'undefined' ? await menu.render({ rows: projectRows }) : null;
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
          projectMenu
            ? html`<div class="st-studio-submenu absolute top-0 w-52" data-et-surface="studio-menu.projects">
                ${projectMenu.body}
              </div>`
            : ''
        }
      </div>
    </div>`,
    styles: styles + buttonStyles + panel.styles + (submenu?.styles ?? '') + (projectMenu?.styles ?? ''),
    setup: setupStudioMenu,
  };
};

const menuRows = interactionRows<Props, 'closed' | 'open', MenuInteraction>(
  { closed: { open: false }, open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'Studio-wide actions behind the neutral logo tile: the open project (repository) as a submenu trigger whose submenu lists the projects with the open one checked (studio-menu.projects), Projekt öffnen…, the design server actions the server state allows (restart and stop while it runs, start while it is stopped), then Einstellungen…, Erscheinungsbild as a submenu with Hell, Dunkel and Wie System (studio-menu.appearance), Tastenkürzel…, Hilfe and Über Studio…. An entry ending in … opens a dialog; Hilfe opens the documentation in the browser. The option states draw the project submenu trigger. The element owns its trigger, SDK panel, styles, interaction states and prototype setup. Pages place its 40-px root in the shell rail slot.',
  madeBy: ['gpt-6', 'claude-opus-5-5'],
  states: {
    ...menuRows.states,
    'studio-menu.stopped': { open: true, server: 'stopped' },
    'studio-menu.projects': { open: true, projects: true },
    'studio-menu.appearance': { open: true, appearance: true },
    'studio-menu.option-hover': { open: true, option: 'hover' },
    'studio-menu.option-focus-visible': { open: true, option: 'focus-visible' },
    'studio-menu.option-active': { open: true, option: 'active' },
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
