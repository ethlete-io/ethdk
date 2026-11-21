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
import { STUDIO_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/studio-labels';

type CollapseInteraction = Exclude<Interaction, 'disabled'>;

type Props = { interaction?: CollapseInteraction };

const label = STUDIO_LABELS.shell.hidePanel;

export const shellCollapseStyles = buttonStyles;

export const shellCollapse = ({ interaction }: Props = {}) => {
  const markup = withAction(
    button({
      label: icon('panel', { size: 18 }),
      variant: 'transparent',
      color: 'surface',
      size: 'sm',
      class: 'size-control-sm items-center p-0',
    }).replace(
      /^<button /,
      `<button data-et-control="collapse" title="${label}" aria-label="${label}" data-can-animate `,
    ),
    'emit:collapse',
  );

  const forced = interaction ? forceInteraction(markup, interaction) : markup;

  return interaction === 'focus-visible'
    ? `<span class="inline-flex flex-col items-center gap-2"><span class="z-10">${tooltip({ text: label, placement: 'top', anchor: '[data-et-control="collapse"]' })}</span>${forced}</span>`
    : forced;
};

export default definePart({
  note: 'The button in the shell panel head that hides the panel. SDK transparent button: SDK hover, press, focus ring and its 120 ms fade; no hairline ring or raised fill at rest.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5'],
  ...interactionRows<Props, 'collapse', CollapseInteraction>(
    { collapse: {} },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  describe: {
    collapse: 'The transparent panel button with the panel icon; check that no ring or raised fill shows at rest.',
    'collapse-hover': 'The panel button hovered; check the SDK hover fill behind the icon.',
    'collapse-active': 'The panel button pressed; check the darker SDK press fill.',
    'collapse-focus-visible':
      'The panel button focused by keyboard; check the focus ring and the hide-panel tooltip above it, not clipped.',
  },
  implements: 'apps/ethlete-studio/src/app/design-parts/shell-collapse/shell-collapse.component.ts',
  controls: { collapse: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles: [buttonStyles, tooltipStyles].join('\n'),
  render: (props: Props) =>
    drawing({
      body: html`<div
        class="inline-flex ${props.interaction === 'focus-visible' ? 'min-w-10 justify-center pb-space-2' : 'p-space-2'} text-et-surface font-ui"
      >
        ${shellCollapse(props)}
      </div>`,
    }),
});
