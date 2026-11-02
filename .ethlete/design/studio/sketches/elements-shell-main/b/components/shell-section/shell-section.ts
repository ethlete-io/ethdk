import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import { icon, type IconName } from '@system/foundations/icons';
import styles from './shell-section.css?inline';

type SectionInteraction = Exclude<Interaction, 'disabled'>;

type Props = {
  icon: IconName;
  label: string;
  active?: boolean;
  panelHidden?: boolean;
  interaction?: SectionInteraction;
};

const HOVER_PRESS = 'hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15';

const classOf = (active: boolean, panelHidden: boolean) =>
  active && !panelHidden
    ? 'text-et-theme-ink bg-et-theme/20 hover:bg-et-theme/20'
    : `${active ? 'text-et-theme-ink' : 'text-et-surface-muted'} ${HOVER_PRESS}`;

export const shellSectionStyles = styles;

export const shellSection = ({ icon: name, label, active = false, panelHidden = false, interaction }: Props) => {
  const markup = `<button type="button" data-et-control="section" data-can-animate="true" class="st-shell-section flex items-center justify-center p-0 rounded-control-lg ${classOf(active, panelHidden)}" aria-label="${label}" data-et-action="${active && !panelHidden ? 'emit:collapse' : 'emit:sectionChange'}"${active ? ' aria-current="page"' : ''}>${icon(name, { size: 20 })}</button>`;

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export default definePart({
  note: 'A section button in the shell rail: the section icon, muted at rest, theme ink while active, and a theme-tinted fill while its panel is open, when a click hides the panel. Each row draws it at rest, hovered, pressed and focused, with the shell hover fill, pressed fill and inset focus ring on --transition-state.',
  madeBy: ['claude-opus-5-5'],
  ...interactionRows<Props, 'section' | 'open', SectionInteraction>(
    { section: { icon: 'pencil', label: 'Sketches' }, open: { icon: 'grid', label: 'System', active: true } },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { section: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles,
  render: (props: Props) =>
    drawing({
      body: html`<div class="inline-flex p-space-2 bg-et-surface-bg font-ui" data-et-surface>
        ${shellSection(props)}
      </div>`,
    }),
});
