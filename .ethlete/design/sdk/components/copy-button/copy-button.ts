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
  widths: [480],
  controls: {
    icon: { kind: 'button', input: ['pointer', 'keyboard'] },
    text: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="copy-button-frame">${render(props)}</div>`,
      styles: [copyButtonStyles, frame].join('\n'),
    }),
});
