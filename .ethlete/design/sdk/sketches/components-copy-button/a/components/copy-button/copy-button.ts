import { copyButton, copyButtonStyles } from '@ethlete/components/design/copy-button';
import { definePart, drawing } from '@design-system';
import frame from './copy-button.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  outcome?: 'copied' | 'failed';
  interaction?: Interaction;
  disabled?: boolean;
};

const mark = (control: 'icon' | 'text', interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const render = ({ outcome, interaction, disabled }: Props) =>
  ['icon', 'text']
    .map((kind) =>
      copyButton({
        kind: kind as 'icon' | 'text',
        outcome,
        disabled,
        attributes: mark(kind as 'icon' | 'text', interaction),
      }),
    )
    .join('');

export default definePart({
  note: "The SDK copy button: the etCopyButton directive, which carries no template or styling of its own, composed as its docs show it, on a default transparent md et-icon-button (39px round, 20px icon in --et-theme-color-ink-solid) swapping the clipboard icon for a check while copied() holds, and on an md et-text-button (14px label in ink) swapping Copy for Copied!. A failed copy only sets data-copy-failed and announces Copy failed in a visually hidden live region; nothing on screen changes. Hover, focus and press tint the icon button's round with the primary colour at 8, 12 and 16 percent and draw the text button's underline; the focus ring is the primary colour, 2px at a 3px offset.",
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
