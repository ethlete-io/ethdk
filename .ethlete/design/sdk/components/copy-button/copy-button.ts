import { copyButton, copyButtonStyles } from '@ethlete/components/design/copy-button';
import { definePart, drawing } from '@design-system';
import frame from './copy-button.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  outcome?: 'copied' | 'failed';
  interaction?: Interaction;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'lg' | 'xl';
};

const mark = (control: 'icon' | 'text', interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const render = ({ outcome, interaction, disabled, size }: Props) =>
  ['icon', 'text']
    .map((kind) =>
      copyButton({
        kind: kind as 'icon' | 'text',
        outcome,
        disabled,
        size,
        attributes: mark(kind as 'icon' | 'text', interaction),
      }),
    )
    .join('');

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5'],
  states: {
    idle: {},
    copied: { outcome: 'copied' },
    failed: { outcome: 'failed' },
    hover: { interaction: 'hover' },
    active: { interaction: 'active' },
    'focus-visible': { interaction: 'focus-visible' },
    'copied-focus-visible': { outcome: 'copied', interaction: 'focus-visible' },
    disabled: { disabled: true },
    'size-xs': { size: 'xs' },
    'size-sm': { size: 'sm' },
    'size-lg': { size: 'lg' },
    'size-xl': { size: 'xl' },
  },
  describe: {
    idle: 'The icon and text copy buttons at rest; check the copy icon and the label.',
    copied: 'Both buttons after a copy; check the check icon and the Copied feedback.',
    failed: 'Both buttons after a failed copy; check the error icon and the failed feedback.',
    hover: 'Both buttons hovered; check the hover tint.',
    active: 'Both buttons pressed; check that the press goes past hover.',
    'focus-visible': 'Both buttons with keyboard focus; check the focus ring around each.',
    'copied-focus-visible': 'The copied buttons with keyboard focus; check that ring and copied feedback both show.',
    disabled: 'Both buttons disabled; check that they fade.',
    'size-xs': 'Both buttons at xs; check the icon and text size of the step.',
    'size-sm': 'Both buttons at sm; check the icon and text size of the step.',
    'size-lg': 'Both buttons at lg; check the icon and text size of the step.',
    'size-xl': 'Both buttons at xl; check the icon and text size of the step.',
  },
  widths: [480],
  controls: {
    icon: { kind: 'button', input: ['pointer', 'keyboard'] },
    text: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  frame: (body) => `<div class="copy-button-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [copyButtonStyles, frame].join('\n'),
    }),
});
