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
  madeBy: ['claude-opus-5-5'],
  states: {
    info: { type: 'info' },
    success: { type: 'success' },
    warning: { type: 'warning' },
    error: { type: 'error' },
    'without-dismiss': { type: 'info', dismissible: false },
    'close-hover': { type: 'info', close: 'hover' },
    'close-focus-visible': { type: 'info', close: 'focus-visible' },
    'action-hover': { type: 'info', action: 'hover' },
    'action-focus-visible': { type: 'info', action: 'focus-visible' },
    'error-close-focus-visible': { type: 'error', close: 'focus-visible' },
    'error-action-focus-visible': { type: 'error', action: 'focus-visible' },
    all: { type: 'all' },
  },
  widths: [480],
  controls: {
    close: { kind: 'button', input: ['pointer', 'keyboard'] },
    action: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="banner-frame">${render(props)}</div>`,
      styles: [bannerStyles, frame].join('\n'),
    }),
});
