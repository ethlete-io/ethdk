import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import { icon } from '@system/foundations/icons';
import styles from './shell-project-switch.css?inline';

type SwitchInteraction = Exclude<Interaction, 'disabled'>;

type Props = { open?: boolean; interaction?: SwitchInteraction };

export const shellProjectSwitchStyles = styles;

export const shellProjectSwitch = ({ open = false, interaction }: Props = {}) => {
  const markup = html`<button
    class="st-shell-project flex items-center gap-space-2 w-full h-control-md py-0 px-space-2 rounded-control-md bg-surface-raised text-text-muted text-left cursor-pointer hover:bg-surface-overlay aria-expanded:bg-surface-overlay"
    type="button"
    data-et-control="project"
    aria-haspopup="listbox"
    aria-expanded="${open}"
  >
    <span
      class="st-shell-project-badge flex flex-none items-center justify-center rounded-control-sm bg-surface-overlay text-text text-ui-xs font-ui-strong"
      >E</span
    >
    <span class="flex-1 min-w-0 overflow-hidden text-text text-ellipsis whitespace-nowrap">ethlete-sdk</span>
    ${icon('up-down', { size: 16 })}
  </button>`;

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export default definePart({
  note: 'The project switch in the shell panel foot: badge, project name and an up-down chevron across the full panel width; it opens the project picker. Studio hairline button: hover and open lift to the overlay fill, press to the pressed fill, focus draws the teal Studio ring, all on --transition-state.',
  ...interactionRows<Props, 'closed' | 'open', SwitchInteraction>(
    { closed: { open: false }, open: { open: true } },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { project: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles,
  render: (props: Props) =>
    drawing({
      body: html`<div class="box-border w-62 p-space-2 bg-surface text-text font-ui text-ui-md">
        ${shellProjectSwitch(props)}
      </div>`,
    }),
});
