import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';

type OptionInteraction = Exclude<Interaction, 'disabled'>;

type Props = { name: string; selected?: boolean; interaction?: OptionInteraction };

export const shellProjectOptionStyles = '';

export const shellProjectOption = ({ name, selected = false, interaction }: Props) => {
  const markup = `<div class="flex items-center min-h-control-md py-0 px-space-2 rounded-control-md${selected ? ' bg-accent-subtle text-accent-text' : ''}" role="option" data-et-control="option" aria-selected="${selected}">${name}</div>`;

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export default definePart({
  note: 'One project row in the project picker. Today: the selected row is accent-subtle; no look of its own for hover, press or focus.',
  ...interactionRows<Props, 'option' | 'selected', OptionInteraction>(
    { option: { name: 'fut-frontend' }, selected: { name: 'ethlete-sdk', selected: true } },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { option: { kind: 'row', input: ['pointer', 'keyboard'] } },
  render: (props: Props) =>
    drawing({
      body: html`<div
        class="box-border w-62 p-space-1 rounded-control-lg bg-surface-overlay text-text font-ui text-ui-md"
        role="listbox"
        aria-label="Projekt auswählen"
      >
        ${shellProjectOption(props)}
      </div>`,
    }),
});
