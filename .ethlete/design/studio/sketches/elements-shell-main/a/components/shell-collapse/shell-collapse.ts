import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import { icon } from '@system/foundations/icons';
import styles from './shell-collapse.css?inline';

type CollapseInteraction = Exclude<Interaction, 'disabled'>;

type Props = { interaction?: CollapseInteraction };

export const shellCollapseStyles = styles;

export const shellCollapse = ({ interaction }: Props = {}) => {
  const markup = html`<button
    class="st-shell-collapse flex items-center justify-center size-control-sm p-0 rounded-control-md bg-surface-raised text-text"
    type="button"
    data-et-control="collapse"
    title="Hide panel"
    aria-label="Hide panel"
  >
    ${icon('panel', { size: 18 })}
  </button>`;

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export default definePart({
  note: 'The button in the shell panel head that hides the panel. Today: hairline ring on the raised fill at rest, and no look of its own for hover, press or focus.',
  ...interactionRows<Props, 'collapse', CollapseInteraction>(
    { collapse: {} },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { collapse: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles,
  render: (props: Props) =>
    drawing({
      body: html`<div class="inline-flex p-space-2 bg-surface text-text font-ui">${shellCollapse(props)}</div>`,
    }),
});
