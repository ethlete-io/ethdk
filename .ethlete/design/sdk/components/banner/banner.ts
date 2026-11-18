import { banner, BannerMockType, bannerStyles } from '@ethlete/components/design/banner';
import { definePart, drawing } from '@design-system';
import frame from './banner.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  type: BannerMockType | 'all';
  dismissible?: boolean;
  close?: Interaction;
  action?: Interaction;
};

const COLORS: Record<BannerMockType, string | undefined> = {
  info: undefined,
  success: undefined,
  warning: 'warning',
  error: 'danger',
};

const COPY: Record<BannerMockType, { heading: string; description: string; action?: string }> = {
  info: {
    heading: 'Round 4 is open',
    description: 'Predictions close at kick-off of the first match.',
    action: 'View fixtures',
  },
  success: { heading: 'Changes saved', description: 'Both teams and the referee get an email with the new time.' },
  warning: {
    heading: 'Storage almost full',
    description: 'You are running low on storage space - consider upgrading your plan.',
    action: 'Upgrade',
  },
  error: {
    heading: 'Result not saved',
    description: 'The connection dropped before the server answered.',
    action: 'Retry',
  },
};

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const draw = (type: BannerMockType, { dismissible = true, close, action }: Omit<Props, 'type'> = {}) =>
  banner({
    type,
    color: COLORS[type],
    ...COPY[type],
    actionAttributes: mark('action', action),
    dismissible,
    dismissAttributes: mark('close', close),
  });

const render = ({ type, ...rest }: Props) =>
  type === 'all'
    ? (['info', 'success', 'warning', 'error'] as const).map((each) => draw(each)).join('')
    : draw(type, rest);

export default definePart({
  note: 'Decided rules only',
  consumerAction: 'its buttons are actions the consumer projects',
  madeBy: ['claude-opus-5-5', 'design check'],
  states: {
    info: { type: 'info' },
    success: { type: 'success' },
    warning: { type: 'warning' },
    error: { type: 'error' },
    'without-dismiss': { type: 'info', dismissible: false },
    action: { type: 'info' },
    'close-hover': { type: 'info', close: 'hover' },
    'close-active': { type: 'info', close: 'active' },
    'close-focus-visible': { type: 'info', close: 'focus-visible' },
    'action-hover': { type: 'info', action: 'hover' },
    'action-active': { type: 'info', action: 'active' },
    'action-focus-visible': { type: 'info', action: 'focus-visible' },
    'error-close-focus-visible': { type: 'error', close: 'focus-visible' },
    'error-action-focus-visible': { type: 'error', action: 'focus-visible' },
    all: { type: 'all' },
  },
  describe: {
    info: 'The info banner with heading, text, View fixtures and close; check the icon, the action and the close button in one row.',
    success: 'The success banner without an action; check its icon and colour and that the text fills the row.',
    warning: 'The warning banner with Upgrade; check that the warning tint and the text keep their contrast.',
    error: 'The error banner with Retry in the danger colour; check the icon and that Retry reads on the tint.',
    'without-dismiss': 'The info banner without its close button; check that the text and action take the freed space.',
    action: 'The info banner at rest as the action row of the grid; check View fixtures at rest.',
    'close-hover': 'The info close button hovered; check the round hover tint behind the icon.',
    'close-active': 'The info close button pressed; check that the round tint goes a step past hover.',
    'close-focus-visible': 'The info close button with keyboard focus; check that the focus ring shows around it.',
    'action-hover': 'View fixtures hovered; check that the action shows its hover look.',
    'action-active': 'View fixtures pressed; check that the action goes a step past its hover look.',
    'action-focus-visible': 'View fixtures with keyboard focus; check that the focus ring shows around it.',
    'error-close-focus-visible':
      'The error close button with keyboard focus; check that the ring stays visible on the danger tint.',
    'error-action-focus-visible':
      'Retry with keyboard focus on the error banner; check that the ring stays visible on the danger tint.',
    all: 'The four banner types stacked; check that info, success, warning and error each read as their own colour.',
  },
  motions: {
    'close-hover-in': { from: 'info', to: 'close-hover' },
    'close-hover-out': { from: 'close-hover', to: 'info' },
    'close-press': { from: 'close-hover', to: 'close-active' },
    'close-release': { from: 'close-active', to: 'close-hover' },
    'action-hover-in': { from: 'action', to: 'action-hover' },
    'action-hover-out': { from: 'action-hover', to: 'action' },
    'action-press': { from: 'action-hover', to: 'action-active' },
    'action-release': { from: 'action-active', to: 'action-hover' },
    'action-tap': { from: 'action', to: 'action-active' },
    'action-lift': { from: 'action-active', to: 'action' },
  },
  grid: {
    columns: ['rest', 'hover', 'active', 'focus-visible'] as const,
    rows: {
      close: { rest: 'info', hover: 'close-hover', active: 'close-active', 'focus-visible': 'close-focus-visible' },
      action: {
        rest: 'action',
        hover: 'action-hover',
        active: 'action-active',
        'focus-visible': 'action-focus-visible',
      },
    },
  },
  widths: [480],
  controls: {
    close: { kind: 'button', input: ['pointer', 'keyboard'] },
    action: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  frame: (body) => `<div class="banner-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [bannerStyles, frame].join('\n'),
    }),
});
