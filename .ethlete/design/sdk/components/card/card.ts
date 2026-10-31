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
  note: 'Decided rules only',
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
  frame: (body) => `<div class="card-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: card({ variant: props.variant, content: content(props) }),
      styles: [cardStyles, frame].join('\n'),
    }),
});
