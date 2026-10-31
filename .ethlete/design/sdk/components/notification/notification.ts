import { notification, notificationStack, notificationStyles } from '@ethlete/components/design/notification';
import { definePart, drawing } from '@design-system';
import edge from './notification.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Status = 'success' | 'error' | 'info' | 'loading';

type Props = {
  status: Status | 'stack';
  close?: Interaction;
  action?: Interaction;
  secondary?: Interaction;
};

const PANE = 'data-et-surface-fill';

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const draw = (status: Status, { close, action, secondary }: Omit<Props, 'status'> = {}) => {
  const controls = {
    dismissAttributes: mark('close', close),
    attributes: PANE,
  };

  switch (status) {
    case 'success':
      return notification({
        status,
        title: 'Kick-off moved',
        message: 'Both teams and the referee get an email with the new time.',
        action: { label: 'Undo', attributes: mark('action', action) },
        ...controls,
      });
    case 'error':
      return notification({
        status,
        color: 'danger',
        title: 'Result not saved',
        message: 'The connection dropped before the server answered.',
        action: { label: 'Retry', attributes: mark('action', action) },
        secondaryAction: { label: 'Details', attributes: mark('secondary', secondary) },
        ...controls,
      });
    case 'info':
      return notification({
        status,
        title: 'Round 4 is open',
        message: 'Predictions close at kick-off of the first match.',
        ...controls,
      });
    case 'loading':
      return notification({
        status,
        title: 'Uploading 3 files',
        message: 'You can keep working while this runs.',
        ...controls,
      });
  }
};

const render = ({ status, ...interactions }: Props) =>
  status === 'stack'
    ? notificationStack((['loading', 'info', 'error', 'success'] as const).map((each) => draw(each)))
    : draw(status, interactions);

export default definePart({
  note: 'The SDK notification (et-notification), drawn by its mock from @ethlete/components/design: one notification per status with title, message, dismiss icon button and, where the status has them, a primary and a secondary text-button action; the four statuses in the stack column. The pane sits one surface level above the page, as the component forces elevation 1. Error takes the danger theme (the semantic error theme); success, info and loading take the theme around them, since the design product registers no success theme.',
  madeBy: ['claude-opus-5-5'],
  states: {
    success: { status: 'success' },
    error: { status: 'error' },
    info: { status: 'info' },
    loading: { status: 'loading' },
    'close-hover': { status: 'error', close: 'hover' },
    'close-focus-visible': { status: 'error', close: 'focus-visible' },
    'action-focus-visible': { status: 'error', action: 'focus-visible' },
    'secondary-focus-visible': { status: 'error', secondary: 'focus-visible' },
    'success-close-focus-visible': { status: 'success', close: 'focus-visible' },
    'success-action-focus-visible': { status: 'success', action: 'focus-visible' },
    stack: { status: 'stack' },
  },
  widths: [480],
  contrast: {
    exceptions: [
      {
        selector: '.et-notification-message',
        reason:
          "Today the message is the muted surface colour at 0.65 opacity; its contrast is an open point, not this round's question.",
      },
    ],
  },
  controls: {
    close: { kind: 'button', input: ['pointer', 'keyboard'] },
    action: { kind: 'button', input: ['pointer', 'keyboard'] },
    secondary: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="notification-frame">${render(props)}</div>`,
      styles: [notificationStyles, edge].join('\n'),
    }),
});
