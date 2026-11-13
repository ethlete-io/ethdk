import { definePart, drawing, html, interactionRows } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import { action, type MenuInteraction, type Server, serverRows, studioTrigger } from '@shared/studio-menu-rows';
import menu from '@system/components/menu';
import { setupStudioMenu } from './setup';
import styles from './studio-menu.css?inline';

type Props = { open: boolean; server?: Server; interaction?: MenuInteraction; option?: MenuInteraction };

const studioRows = (server: Server, option?: MenuInteraction): MenuMockRow[] => [
  ...serverRows(server, option),
  { kind: 'separator' },
  { label: 'Einstellungen…', shortcut: 'Ctrl ,', attributes: action('settings', 'emit:openSettings') },
  { label: 'Erscheinungsbild…', attributes: action('appearance', 'emit:openSettings') },
  { label: 'Tastenkürzel…', shortcut: 'Ctrl /', attributes: action('shortcuts', 'emit:openSettings') },
  { kind: 'separator' },
  { label: 'Hilfe…', attributes: action('help', 'emit:openSettings') },
  { label: 'Über Studio…', attributes: action('about', 'emit:openSettings') },
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
  note: 'Studio-wide actions behind the neutral logo tile: the design server actions the server state allows (restart and stop while it runs, start while it is stopped), then Einstellungen…, Erscheinungsbild…, Tastenkürzel…, Hilfe… and Über Studio…. Each entry opens the Einstellungen page at its own section. The element owns its trigger, SDK panel, styles, interaction states and prototype setup. Pages place its 40-px root in the shell rail slot.',
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
