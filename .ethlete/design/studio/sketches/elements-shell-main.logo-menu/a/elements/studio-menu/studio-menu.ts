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

type Props = { open: boolean; server?: Server; interaction?: MenuInteraction; option?: MenuInteraction };

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

const optionAttributes = (base: string, option?: MenuInteraction) =>
  option ? `${base} data-et-force="${option}"` : base;

const studioRows = (server: Server, option?: MenuInteraction): MenuMockRow[] => [
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
        index === 0 ? action('project', 'closed') : action('project', 'emit:projectChange'),
        index === 1 ? option : undefined,
      ),
    })),
  },
  { label: 'Projekt öffnen…', attributes: action('open-project', 'emit:openProject') },
  { kind: 'separator' },
  { kind: 'label', label: 'Design-Server' },
  ...SERVER_ACTIONS[server].map(({ name, label }) => ({ label, attributes: action(name, 'emit:serverAction') })),
];

const studioPanel = (server: Server, interaction?: MenuInteraction, option?: MenuInteraction) =>
  menu.render({ rows: studioRows(server, option), forced: interaction });

export const studioMenu = async ({ open, server = 'running', interaction, option }: Props) => {
  const panel =
    typeof location === 'undefined'
      ? { body: '', styles: '' }
      : await studioPanel(server, open ? interaction : undefined, open ? option : undefined);
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
      </div>
    </div>`,
    styles: styles + buttonStyles + panel.styles,
    setup: setupStudioMenu,
  };
};

const menuRows = interactionRows<Props, 'closed' | 'open', MenuInteraction>(
  { closed: { open: false }, open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'Studio-wide actions behind the neutral logo tile: the project (repository) switch with the open one checked, Projekt öffnen…, and the design server actions the server state allows (restart and stop while it runs, start while it is stopped). The option states draw the second project. The element owns its trigger, SDK panel, styles, interaction states and prototype setup. Pages place its 40-px root in the shell rail slot.',
  madeBy: ['gpt-6', 'claude-opus-5-5'],
  states: {
    ...menuRows.states,
    'studio-menu.stopped': { open: true, server: 'stopped' },
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
      body: html`<div class="box-border w-xl h-100 p-space-3 text-et-surface font-ui text-ui-md">${menu.body}</div>`,
      setup: menu.setup,
      styles: menu.styles,
    });
  },
});
