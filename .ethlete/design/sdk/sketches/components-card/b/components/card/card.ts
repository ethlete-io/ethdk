import { button } from '@ethlete/components/design/button';
import { card, cardContent, CardMockOptions, cardPlaceholderMedia, cardStyles } from '@ethlete/components/design/card';
import { definePart, drawing } from '@design-system';
import frame from './card.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  variant: NonNullable<CardMockOptions['variant']>;
  form?: 'full' | 'media' | 'plain';
  confirm?: Interaction;
  cancel?: Interaction;
};

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const actions = ({ confirm, cancel }: Props) =>
  `<div class="et-card-mock-actions">${[
    button({ label: 'Cancel', variant: 'outline' }).replace(/^<button /, `<button ${mark('cancel', cancel)} `),
    button({ label: 'Open', variant: 'filled' }).replace(/^<button /, `<button ${mark('confirm', confirm)} `),
  ].join('')}</div>`;

const content = (props: Props) => {
  if (props.form === 'plain') return cardContent({ title: 'Revenue', text: '$12,400 this month' });

  return (
    cardContent({
      media: props.form === 'media' ? cardPlaceholderMedia : undefined,
      title: 'Spring league',
      subtitle: 'Starts 12 April',
      text: 'Eight teams play two rounds. Sign-ups close one week before kick-off.',
    }) + actions(props)
  );
};

export default definePart({
  note: 'The SDK card (et-card), drawn by its mock from @ethlete/components/design: a padded flex column (16px padding, 12px gap, 8px radius) on the surface background, as outlined (1px surface border, the default), elevated (0 4px 16px shadow at 12 %) or filled (no edge). The card owns only that chrome; the title, subtitle, text, media and the outline Cancel and filled Open buttons are consumer content drawn by the mock. The card has no hover, active or focus states of its own.',
  madeBy: ['claude-opus-5-5'],
  states: {
    outlined: { variant: 'outlined' },
    elevated: { variant: 'elevated' },
    filled: { variant: 'filled' },
    media: { variant: 'outlined', form: 'media' },
    plain: { variant: 'outlined', form: 'plain' },
    'confirm-focus-visible': { variant: 'outlined', confirm: 'focus-visible' },
    'cancel-focus-visible': { variant: 'outlined', cancel: 'focus-visible' },
  },
  widths: [480],
  controls: {
    cancel: { kind: 'button', input: ['pointer', 'keyboard'] },
    confirm: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="card-frame">${card({ variant: props.variant, content: content(props) })}</div>`,
      styles: [cardStyles, frame].join('\n'),
    }),
});
