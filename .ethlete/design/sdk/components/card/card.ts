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
  consumerAction: 'its buttons are actions the consumer projects',
  madeBy: ['claude-opus-5-5', 'design check'],
  states: {
    outlined: { variant: 'outlined' },
    elevated: { variant: 'elevated' },
    filled: { variant: 'filled' },
    media: { variant: 'outlined', form: 'media' },
    plain: { variant: 'outlined', form: 'plain' },
    confirm: { variant: 'outlined' },
    'confirm-hover': { variant: 'outlined', confirm: 'hover' },
    'confirm-active': { variant: 'outlined', confirm: 'active' },
    'confirm-focus-visible': { variant: 'outlined', confirm: 'focus-visible' },
    'cancel-hover': { variant: 'outlined', cancel: 'hover' },
    'cancel-active': { variant: 'outlined', cancel: 'active' },
    'cancel-focus-visible': { variant: 'outlined', cancel: 'focus-visible' },
  },
  describe: {
    outlined: 'The outlined card with title, subtitle, text, Cancel and Open; check the border against the page.',
    elevated: 'The elevated card; check the shadow and the raised fill against the page.',
    filled: 'The filled card; check that its fill differs from the page without a border.',
    media: 'The outlined card with a media image on top; check that the image fills the top edge inside the radius.',
    plain: 'A plain outlined card with Revenue and an amount only; check the padding without actions.',
    confirm: 'The outlined card at rest as the Open row of the grid; check Open at rest.',
    'confirm-hover': 'Open hovered; check that the filled button takes its hover fill inside the card.',
    'confirm-active': 'Open pressed; check that the fill goes a step past hover.',
    'confirm-focus-visible': 'Open with keyboard focus; check the focus ring around the button inside the card.',
    'cancel-hover': 'Cancel hovered; check that the outline button takes its hover tint inside the card.',
    'cancel-active': 'Cancel pressed; check that the tint goes a step past hover.',
    'cancel-focus-visible': 'Cancel with keyboard focus; check the focus ring around the outline button.',
  },
  motions: {
    'cancel-hover-in': { from: 'outlined', to: 'cancel-hover' },
    'cancel-hover-out': { from: 'cancel-hover', to: 'outlined' },
    'cancel-press': { from: 'cancel-hover', to: 'cancel-active' },
    'cancel-release': { from: 'cancel-active', to: 'cancel-hover' },
    'confirm-hover-in': { from: 'confirm', to: 'confirm-hover' },
    'confirm-hover-out': { from: 'confirm-hover', to: 'confirm' },
    'confirm-press': { from: 'confirm-hover', to: 'confirm-active' },
    'confirm-release': { from: 'confirm-active', to: 'confirm-hover' },
    'confirm-tap': { from: 'confirm', to: 'confirm-active' },
    'confirm-lift': { from: 'confirm-active', to: 'confirm' },
  },
  grid: {
    columns: ['rest', 'hover', 'active', 'focus-visible'] as const,
    rows: {
      cancel: {
        rest: 'outlined',
        hover: 'cancel-hover',
        active: 'cancel-active',
        'focus-visible': 'cancel-focus-visible',
      },
      confirm: {
        rest: 'confirm',
        hover: 'confirm-hover',
        active: 'confirm-active',
        'focus-visible': 'confirm-focus-visible',
      },
    },
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
