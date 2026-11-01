import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import menu from '@system/components/menu';
import { studioMark } from '@system/foundations/logo';
import { setupStudioMenu } from './setup';
import styles from './studio-menu.css?inline';

type Props = { open: boolean; interaction?: Exclude<Interaction, 'disabled'> };

const studioTrigger = (open: boolean, interaction?: Exclude<Interaction, 'disabled'>) => {
  const markup = button({
    label: studioMark(40),
    variant: 'transparent',
    color: 'surface',
    size: 'sm',
    class: 'st-studio-trigger p-0',
  }).replace(
    /^<button /,
    `<button data-et-control="studio-menu" data-studio-trigger data-et-auto-surface aria-label="Studio-Menü" aria-haspopup="menu" aria-expanded="${open}" aria-controls="studio-menu-surface" `,
  );
  return interaction ? forceInteraction(markup, interaction) : markup;
};

const action = (name: string) => `data-et-control="item" data-studio-action="${name}"`;

const STUDIO_ROWS: MenuMockRow[] = [
  { kind: 'label', label: 'Studio' },
  { label: 'Einstellungen…', attributes: action('settings') },
  { label: 'Erscheinungsbild…', attributes: action('appearance') },
  { label: 'Tastenkürzel…', attributes: action('shortcuts') },
  { kind: 'separator' },
  { label: 'Hilfe', attributes: action('help') },
  { label: 'Über Studio…', attributes: action('about') },
];

const studioPanel = async (interaction?: Exclude<Interaction, 'disabled'>) => {
  const panel = await menu.render({ rows: STUDIO_ROWS, forced: interaction });
  // The SDK menu part replaces the attributes of its second row with its own force marks; this puts the action back.
  return { ...panel, body: panel.body.replace('data-et-control="item"', action('settings')) };
};

export const studioMenu = async ({ open, interaction }: Props) => {
  const panel =
    typeof location === 'undefined' ? { body: '', styles: '' } : await studioPanel(open ? interaction : undefined);
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

export default definePart({
  note: 'Studio-wide actions behind the neutral logo tile: settings, appearance, shortcuts, help and about. The element owns its trigger, SDK panel, styles, interaction states and prototype setup. Pages place its 40-px root in the shell rail slot. Menu destinations are separate work.',
  madeBy: ['gpt-6'],
  ...interactionRows<Props, 'closed' | 'open', Exclude<Interaction, 'disabled'>>(
    { closed: { open: false }, open: { open: true } },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { 'studio-menu': { kind: 'menu', input: ['pointer', 'keyboard'], surfaces: { open: 'open' } } },
  styles: styles + buttonStyles,
  implements: 'apps/ethlete-studio/src/app/design-parts/studio-menu/studio-menu.component.ts',
  render: async (props: Props) => {
    const menu = await studioMenu(props);
    return drawing({
      body: html`<div class="box-border w-xl h-64 p-space-3 bg-et-surface-bg text-et-surface font-ui text-ui-md">
        ${menu.body}
      </div>`,
      setup: menu.setup,
      styles: menu.styles,
    });
  },
});
