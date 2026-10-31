import { definePart, drawing, forceInteraction, html, interactionRows, ng, type Interaction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
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
    `<button data-et-control="studio-menu" data-studio-trigger aria-label="Studio-Menü" aria-haspopup="menu" aria-expanded="${open}" aria-controls="studio-menu-surface" `,
  );
  return interaction ? forceInteraction(markup, interaction) : markup;
};

const studioPanel = async (interaction?: Exclude<Interaction, 'disabled'>) => {
  const settings = '<button et-menu-item data-studio-action="settings" type="button">Einstellungen…</button>';
  const rendered = await ng(
    html`<div [hoverOpen]="false" etMenu>
      <et-menu aria-label="Studio">
        <et-menu-group-label>Studio</et-menu-group-label>
        ${settings}
        <button et-menu-item data-studio-action="appearance" type="button">Erscheinungsbild…</button>
        <button et-menu-item data-studio-action="shortcuts" type="button">Tastenkürzel…</button>
        <et-menu-separator />
        <button et-menu-item data-studio-action="help" type="button">Hilfe</button>
        <button et-menu-item data-studio-action="about" type="button">Über Studio…</button>
      </et-menu>
    </div>`,
    { imports: ['MENU_IMPORTS'] },
  );
  return interaction
    ? rendered.replace(/<button\b[^>]*data-studio-action="settings"[^>]*>/, (tag) =>
        forceInteraction(tag.replace(/>$/, ' data-active>'), interaction),
      )
    : rendered;
};

export const studioMenu = async ({ open, interaction }: Props) => {
  const panel = typeof location === 'undefined' ? '' : await studioPanel(open ? interaction : undefined);
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
        ${panel}
      </div>
    </div>`,
    styles: styles + buttonStyles,
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
  render: async (props: Props) => {
    const menu = await studioMenu(props);
    return drawing({
      body: html`<div class="box-border w-xl h-64 p-space-3 bg-surface text-text font-ui text-ui-md">
        ${menu.body}
      </div>`,
      setup: menu.setup,
    });
  },
});
