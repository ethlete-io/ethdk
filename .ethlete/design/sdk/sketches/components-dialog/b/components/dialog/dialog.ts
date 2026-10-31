import { alertDialog, dialog, dialogStyles, overlayBackdrop } from '@ethlete/components/design/dialog';
import { definePart, drawing } from '@design-system';
import edge from './dialog.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  kind: 'dialog' | 'alert';
  long?: boolean;
  close?: Interaction;
  confirm?: Interaction;
  cancel?: Interaction;
};

const PANE = 'data-et-surface-fill';

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const SHORT = '<p>Kick-off moves to 18:30. Both teams and the referee get an email with the new time.</p>';

const LONG = Array.from(
  { length: 8 },
  (_, index) =>
    `<p>Round ${index + 1}: every match of this round moves by one week. Teams that already confirmed get asked again, and open predictions stay open until the new kick-off.</p>`,
).join('');

const render = ({ kind, long, close, confirm, cancel }: Props) =>
  kind === 'alert'
    ? alertDialog({
        kind: 'confirm',
        title: 'Delete this match?',
        message: 'The match, its result and every prediction on it are removed. This cannot be undone.',
        confirmLabel: 'Delete',
        confirmAttributes: mark('confirm', confirm),
        cancelAttributes: mark('cancel', cancel),
        attributes: PANE,
      })
    : dialog({
        title: long ? 'Move the season' : 'Move kick-off',
        body: long ? LONG : SHORT,
        close: mark('close', close),
        dividers: long ? 'dynamic' : false,
        actions: [
          { label: 'Cancel', variant: 'outline', attributes: mark('cancel', cancel) },
          { label: 'Save', attributes: mark('confirm', confirm) },
        ],
        attributes: PANE,
      });

export default definePart({
  note: 'The SDK dialog, drawn by its mock from @ethlete/components/design: the dialog pane over the backdrop with a title, a close icon button, the body and a footer with an outline and a filled button; the confirm alert dialog; a long body that scrolls between dynamic dividers.',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: { kind: 'dialog' },
    'close-hover': { kind: 'dialog', close: 'hover' },
    'close-focus-visible': { kind: 'dialog', close: 'focus-visible' },
    'confirm-focus-visible': { kind: 'dialog', confirm: 'focus-visible' },
    'cancel-focus-visible': { kind: 'dialog', cancel: 'focus-visible' },
    alert: { kind: 'alert' },
    'alert-cancel-focus-visible': { kind: 'alert', cancel: 'focus-visible' },
    'alert-confirm-focus-visible': { kind: 'alert', confirm: 'focus-visible' },
    'long-body': { kind: 'dialog', long: true },
  },
  widths: [480],
  controls: {
    close: { kind: 'button', input: ['pointer', 'keyboard'] },
    cancel: { kind: 'button', input: ['pointer', 'keyboard'] },
    confirm: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="dialog-frame">${overlayBackdrop(render(props))}</div>`,
      styles: [dialogStyles, edge].join('\n'),
    }),
});
