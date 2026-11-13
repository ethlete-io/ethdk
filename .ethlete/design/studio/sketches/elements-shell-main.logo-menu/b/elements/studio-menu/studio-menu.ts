import {
  definePart,
  drawing,
  forceInteraction,
  html,
  interactionRows,
  type Interaction,
  withAction,
} from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import menu from '@system/components/menu';
import { studioMark } from '@system/foundations/logo';
import { setupStudioMenu } from './setup';
import styles from './studio-menu.css?inline';

type MenuInteraction = Exclude<Interaction, 'disabled'>;

type Server = 'running' | 'stopped';

type Props = {
  open: boolean;
  server?: Server;
  projects?: boolean;
  interaction?: MenuInteraction;
  option?: MenuInteraction;
};

const studioTrigger = (open: boolean, interaction?: Exclude<Interaction, 'disabled'>) => {
  const markup = withAction(
    button({
      label: studioMark(40),
      variant: 'transparent',
      color: 'surface',
      size: 'sm',
      class: 'st-studio-trigger p-0 [--et-button-border-radius:var(--radius-control-lg)] [--et-button-border-width:0]',
    }).replace(
      /^<button /,
      `<button data-et-control="studio-menu" data-studio-trigger data-et-auto-surface aria-label="Studio-Menü" aria-haspopup="menu" aria-expanded="${open}" aria-controls="studio-menu-surface" `,
    ),
    open ? 'closed' : 'open',
  );
  return interaction ? forceInteraction(markup, interaction) : markup;
};

const action = (name: string, emit: string) =>
  `data-studio-action="${name}" data-et-action="${emit}" data-et-slot="components/menu"`;

const SERVER_ACTIONS: Record<Server, { name: string; label: string }[]> = {
  running: [
    { name: 'restart', label: 'Design-Server neu starten' },
    { name: 'stop', label: 'Design-Server stoppen' },
  ],
  stopped: [{ name: 'start', label: 'Design-Server starten' }],
};

const REPOS = ['ethlete-sdk', 'fut-frontend', 'design-playground'];

const studioRows = (server: Server, projects: boolean, option?: MenuInteraction): MenuMockRow[] => [
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
  { kind: 'label', label: 'Design-Server' },
  ...SERVER_ACTIONS[server].map(({ name, label }) => ({ label, attributes: action(name, 'emit:serverAction') })),
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

const studioPanel = (server: Server, projects: boolean, interaction?: MenuInteraction, option?: MenuInteraction) =>
  menu.render({ rows: studioRows(server, projects, option), forced: interaction });

export const studioMenu = async ({ open, server = 'running', projects = false, interaction, option }: Props) => {
  const panel =
    typeof location === 'undefined'
      ? { body: '', styles: '' }
      : await studioPanel(server, open && projects, open ? interaction : undefined, open ? option : undefined);
  const submenu = open && projects && typeof location !== 'undefined' ? await menu.render({ rows: projectRows }) : null;
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
            ? html`<div class="st-studio-submenu absolute top-0 w-52" data-et-surface="studio-menu.projects">
                ${submenu.body}
              </div>`
            : ''
        }
      </div>
    </div>`,
    styles: styles + buttonStyles + panel.styles + (submenu?.styles ?? ''),
    setup: setupStudioMenu,
  };
};

const menuRows = interactionRows<Props, 'closed' | 'open', MenuInteraction>(
  { closed: { open: false }, open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'Studio-wide actions behind the neutral logo tile: the open project (repository) as a submenu trigger whose submenu lists the projects with the open one checked (studio-menu.projects), Projekt öffnen…, and the design server actions the server state allows (restart and stop while it runs, start while it is stopped). The option states draw the project submenu trigger. The element owns its trigger, SDK panel, styles, interaction states and prototype setup. Pages place its 40-px root in the shell rail slot.',
  madeBy: ['gpt-6', 'claude-opus-5-5'],
  states: {
    ...menuRows.states,
    'studio-menu.stopped': { open: true, server: 'stopped' },
    'studio-menu.projects': { open: true, projects: true },
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
