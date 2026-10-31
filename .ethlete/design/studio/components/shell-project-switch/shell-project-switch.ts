import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import { icon } from '@system/foundations/icons';
import styles from './shell-project-switch.css?inline';

type SwitchInteraction = Exclude<Interaction, 'disabled'>;

type Props = { open?: boolean; interaction?: SwitchInteraction };

export const shellProjectSwitchStyles = styles + buttonStyles;

export const shellProjectSwitch = ({ open = false, interaction }: Props = {}) => {
  const markup = button({
    label: html`<span
        class="st-shell-project-badge flex flex-none items-center justify-center rounded-control-sm et-surface--dark-elevated-2 bg-(--et-surface-background-solid) text-(--et-surface-color-solid) text-ui-xs font-ui-strong"
        >E</span
      ><span class="flex-1 min-w-0 overflow-hidden text-(--et-surface-color-solid) text-ellipsis whitespace-nowrap"
        >ethlete-sdk</span
      >${icon('up-down', { size: 16 })}`,
    variant: 'transparent',
    color: 'surface',
    size: 'sm',
    class: 'w-full h-control-md justify-start gap-space-2 py-0 px-space-2 text-left',
  }).replace(
    /^<button /,
    `<button data-et-control="project" aria-haspopup="listbox" aria-expanded="${open}" data-can-animate `,
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export default definePart({
  note: 'The project switch in the shell panel foot: badge, project name and an up-down chevron; it opens the project picker. SDK transparent button: SDK hover, press, focus ring and its 120 ms fade. Plain text at rest, and the chevron sits after the name, not at the right edge.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra'],
  ...interactionRows<Props, 'closed' | 'open', SwitchInteraction>(
    { closed: { open: false }, open: { open: true } },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { project: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles: shellProjectSwitchStyles,
  render: (props: Props) =>
    drawing({
      body: html`<div
        class="box-border w-62 p-space-2 et-surface--dark bg-(--et-surface-background-solid) text-(--et-surface-color-solid) font-ui text-ui-md"
      >
        ${shellProjectSwitch(props)}
      </div>`,
    }),
});
