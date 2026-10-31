import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import styles from './shell-project-option.css?inline';

type OptionInteraction = Exclude<Interaction, 'disabled'>;

type Props = { name: string; selected?: boolean; interaction?: OptionInteraction };

export const shellProjectOptionStyles = styles;

export const shellProjectOption = ({ name, selected = false, interaction }: Props) => {
  const markup = `<div class="st-project-option flex items-center min-h-control-md py-0 px-space-2 rounded-control-md cursor-pointer${selected ? ' bg-et-theme/20 text-et-theme-ink hover:bg-et-theme/20' : ' hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15'}" role="option" tabindex="-1" data-et-control="option" aria-selected="${selected}">${name}</div>`;

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export default definePart({
  note: 'One project row in the project picker. Hover lifts to the raised fill, the selected row is accent-subtle and darkens on hover, press draws the pressed fill and focus the teal Studio ring, all on --transition-state.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra'],
  ...interactionRows<Props, 'option' | 'selected', OptionInteraction>(
    { option: { name: 'fut-frontend' }, selected: { name: 'ethlete-sdk', selected: true } },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { option: { kind: 'row', input: ['pointer', 'keyboard'] } },
  styles,
  render: (props: Props) =>
    drawing({
      body: html`<div
        class="box-border w-62 p-space-1 rounded-control-lg et-surface--dark-elevated-2 bg-et-surface-bg text-et-surface font-ui text-ui-md"
        role="listbox"
        aria-label="Projekt auswählen"
      >
        ${shellProjectOption(props)}
      </div>`,
    }),
});
