import { dialogStyles } from '@ethlete/components/design/dialog';
import { definePart, drawing, html } from '@design-system';
import styles from './action-sheet.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  header?: boolean;
  action?: Interaction;
  cancel?: Interaction;
};

type Action = { label: string; destructive?: boolean };

const ACTIONS: Action[] = [
  { label: 'Edit match' },
  { label: 'Share result' },
  { label: 'Pin to top' },
  { label: 'Delete match', destructive: true },
];

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const row = (action: Action, attributes: string) =>
  `<button type="button" ${attributes} class="et-action-sheet-action et-surface-interactive et-focus-ring ${
    action.destructive ? 'et-color--danger' : 'et-color--inherited'
  }"${action.destructive ? ' data-variant="destructive"' : ''}>${action.label}</button>`;

const header = html`<div class="et-action-sheet-header">
  <h2 id="action-sheet-title" class="et-action-sheet-title">Match day 12</h2>
  <p class="et-action-sheet-message">FC North vs. United, Sat 18:30</p>
</div>`;

const page = html`<div class="action-sheet-page" aria-hidden="true">
  <div class="action-sheet-page-bar"></div>
  <div class="action-sheet-page-card"></div>
  <div class="action-sheet-page-card"></div>
  <div class="action-sheet-page-card action-sheet-page-card--short"></div>
</div>`;

const sheet = ({ header: withHeader = true, action, cancel }: Props) =>
  html`<div
    class="et-action-sheet et-surface--inherited"
    data-et-surface-fill
    role="dialog"
    aria-modal="true"
    ${withHeader ? 'aria-labelledby="action-sheet-title"' : 'aria-label="Match actions"'}
  >
    ${withHeader ? header : ''}
    <div class="et-action-sheet-list">
      ${ACTIONS.map((entry, index) => row(entry, mark('action', index === 0 ? action : undefined))).join('')}
    </div>
    <button
      class="et-action-sheet-action et-action-sheet-cancel et-surface-interactive et-focus-ring et-color--inherited"
      type="button"
      ${mark('cancel', cancel)}
    >
      Cancel
    </button>
  </div>`;

export default definePart({
  note: 'Full-width sheet flush to the bottom edge, Cancel as the last row',
  consumerAction: 'its actions are the items the consumer passes in',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: {},
    'without-header': { header: false },
    'action-hover': { action: 'hover' },
    'action-active': { action: 'active' },
    'action-focus-visible': { action: 'focus-visible' },
    'cancel-focus-visible': { cancel: 'focus-visible' },
  },
  describe: {
    default:
      'The sheet over a dimmed page with title, message, four actions and Cancel; check that it sits flush at the bottom and Delete match is red.',
    'without-header':
      'The sheet with only its actions and Cancel; check that the list starts at the top edge without a gap.',
    'action-hover': 'Edit match hovered; check that the row takes the hover tint across the full width.',
    'action-active': 'Edit match pressed; check that the tint goes a step past hover.',
    'action-focus-visible':
      'Edit match with keyboard focus; check that the focus ring shows inside the sheet and is not cut.',
    'cancel-focus-visible':
      'Cancel with keyboard focus; check that the focus ring shows around the last row and is not cut at the bottom.',
  },
  widths: [390],
  instant:
    'Rows take their hover and press tint at once; the sheet enters and leaves with the overlay strategy motion.',
  controls: {
    action: { kind: 'button', input: ['pointer', 'keyboard'] },
    cancel: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  frame: (body) => `<div class="action-sheet-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: html`<div class="action-sheet-scene">
        ${page}
        <div class="et-overlay-runtime-backdrop et-overlay-backdrop--visible"></div>
        ${sheet(props)}
      </div>`,
      styles: [dialogStyles, styles].join('\n'),
    }),
});
