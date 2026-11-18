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
  note: 'Decided rules only',
  consumerAction: 'its buttons are actions the consumer projects',
  madeBy: ['claude-opus-5-5', 'design check'],
  states: {
    default: { kind: 'dialog' },
    cancel: { kind: 'dialog' },
    confirm: { kind: 'dialog' },
    'close-hover': { kind: 'dialog', close: 'hover' },
    'close-active': { kind: 'dialog', close: 'active' },
    'close-focus-visible': { kind: 'dialog', close: 'focus-visible' },
    'confirm-hover': { kind: 'dialog', confirm: 'hover' },
    'confirm-active': { kind: 'dialog', confirm: 'active' },
    'confirm-focus-visible': { kind: 'dialog', confirm: 'focus-visible' },
    'cancel-hover': { kind: 'dialog', cancel: 'hover' },
    'cancel-active': { kind: 'dialog', cancel: 'active' },
    'cancel-focus-visible': { kind: 'dialog', cancel: 'focus-visible' },
    alert: { kind: 'alert' },
    'alert-cancel-focus-visible': { kind: 'alert', cancel: 'focus-visible' },
    'alert-confirm-focus-visible': { kind: 'alert', confirm: 'focus-visible' },
    'long-body': { kind: 'dialog', long: true },
  },
  describe: {
    default:
      'Move kick-off over the backdrop with text, close, Cancel and Save; check the title row and the actions at the end.',
    cancel: 'Move kick-off at rest as the Cancel row of the grid; check Cancel at rest.',
    confirm: 'Move kick-off at rest as the Save row of the grid; check Save at rest.',
    'close-hover': 'The close button hovered; check its round hover tint.',
    'close-active': 'The close button pressed; check that the round tint goes a step past hover.',
    'close-focus-visible': 'The close button with keyboard focus; check the focus ring around it.',
    'confirm-hover': 'Save hovered; check that the filled button takes its hover fill.',
    'confirm-active': 'Save pressed; check that the fill goes a step past hover.',
    'confirm-focus-visible': 'Save with keyboard focus; check the focus ring around the filled button.',
    'cancel-hover': 'Cancel hovered; check that the outline button takes its hover tint.',
    'cancel-active': 'Cancel pressed; check that the tint goes a step past hover.',
    'cancel-focus-visible': 'Cancel with keyboard focus; check the focus ring around the outline button.',
    alert: 'The Delete this match? alert with Cancel and Delete; check the message and the two actions.',
    'alert-cancel-focus-visible': 'The alert Cancel with keyboard focus; check the focus ring around it.',
    'alert-confirm-focus-visible': 'The alert Delete with keyboard focus; check the focus ring around it.',
    'long-body':
      'Move the season with eight paragraphs; check that the body scrolls and the dividers show above and below it.',
  },
  motions: {
    'close-hover-in': { from: 'default', to: 'close-hover' },
    'close-hover-out': { from: 'close-hover', to: 'default' },
    'close-press': { from: 'close-hover', to: 'close-active' },
    'close-release': { from: 'close-active', to: 'close-hover' },
    'cancel-hover-in': { from: 'cancel', to: 'cancel-hover' },
    'cancel-hover-out': { from: 'cancel-hover', to: 'cancel' },
    'cancel-press': { from: 'cancel-hover', to: 'cancel-active' },
    'cancel-release': { from: 'cancel-active', to: 'cancel-hover' },
    'cancel-tap': { from: 'cancel', to: 'cancel-active' },
    'cancel-lift': { from: 'cancel-active', to: 'cancel' },
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
      close: {
        rest: 'default',
        hover: 'close-hover',
        active: 'close-active',
        'focus-visible': 'close-focus-visible',
      },
      cancel: {
        rest: 'cancel',
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
    close: { kind: 'button', input: ['pointer', 'keyboard'] },
    cancel: { kind: 'button', input: ['pointer', 'keyboard'] },
    confirm: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  frame: (body) => `<div class="dialog-frame">${body}</div>`,
  scrolls: ['long-body'],
  render: (props: Props) =>
    drawing({
      body: overlayBackdrop(render(props)),
      styles: [dialogStyles, edge].join('\n'),
    }),
});
