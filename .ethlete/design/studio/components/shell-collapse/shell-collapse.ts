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
import { tooltip, tooltipStyles } from '@ethlete/components/design/tooltip';
import { icon } from '@system/foundations/icons';

type CollapseInteraction = Exclude<Interaction, 'disabled'>;

type Props = { interaction?: CollapseInteraction };

export const shellCollapseStyles = buttonStyles;

export const shellCollapse = ({ interaction }: Props = {}) => {
  const markup = withAction(
    button({
      label: icon('panel', { size: 18 }),
      variant: 'transparent',
      color: 'surface',
      size: 'sm',
      class: 'size-control-sm p-0',
    }).replace(
      /^<button /,
      '<button data-et-control="collapse" title="Hide panel" aria-label="Hide panel" data-can-animate ',
    ),
    'emit:collapse',
  );

  const forced = interaction ? forceInteraction(markup, interaction) : markup;

  return interaction === 'focus-visible'
    ? `<span class="relative inline-flex">${forced}<span class="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2">${tooltip({ text: 'Hide panel', placement: 'top' })}</span></span>`
    : forced;
};

export default definePart({
  note: 'The button in the shell panel head that hides the panel. SDK transparent button: SDK hover, press, focus ring and its 120 ms fade; no hairline ring or raised fill at rest.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra'],
  ...interactionRows<Props, 'collapse', CollapseInteraction>(
    { collapse: {} },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  implements: 'apps/ethlete-studio/src/app/design-parts/shell-collapse/shell-collapse.component.ts',
  controls: { collapse: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles: [buttonStyles, tooltipStyles].join('\n'),
  render: (props: Props) =>
    drawing({
      body: html`<div
        class="inline-flex p-space-2 ${props.interaction === 'focus-visible' ? 'px-8 pt-12' : ''} text-et-surface font-ui"
      >
        ${shellCollapse(props)}
      </div>`,
    }),
});
