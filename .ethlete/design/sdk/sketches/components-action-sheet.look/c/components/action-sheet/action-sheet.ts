import { button } from '@ethlete/components/design/button';
import { dialogStyles } from '@ethlete/components/design/dialog';
import { iconMarkup } from '@ethlete/components/design/icon';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, drawing, html } from '@design-system';
import styles from './action-sheet.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  header?: boolean;
  action?: Interaction;
  cancel?: Interaction;
};

type Action = { label: string; icon: string; destructive?: boolean };

const ACTIONS: Action[] = [
  { label: 'Edit match', icon: 'et-pencil' },
  { label: 'Share result', icon: 'et-arrow-out-up-right' },
  { label: 'Pin to top', icon: 'et-thumbtack' },
  { label: 'Delete match', icon: 'et-trash', destructive: true },
];

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const icon = (name: string) => {
  const definition = SDK_ICONS.find((entry) => entry.name === name);

  if (!definition) throw new Error(`no SDK icon ${name}`);

  return iconMarkup(definition, 'et-action-sheet-icon');
};

const row = (action: Action, attributes: string) =>
  `<button type="button" ${attributes} class="et-action-sheet-action et-surface-interactive et-focus-ring ${
    action.destructive ? 'et-color--danger' : 'et-color--inherited'
  }"${action.destructive ? ' data-variant="destructive"' : ''}>${icon(action.icon)}<span>${action.label}</span></button>`;

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
    class="et-action-sheet"
    role="dialog"
    aria-modal="true"
    ${withHeader ? 'aria-labelledby="action-sheet-title"' : 'aria-label="Match actions"'}
  >
    <div class="et-action-sheet-group et-surface--inherited" data-et-surface-fill>
      ${withHeader ? header : ''}
      ${ACTIONS.map((entry, index) => row(entry, mark('action', index === 0 ? action : undefined))).join('')}
    </div>
    <div class="et-action-sheet-cancel-surface et-surface--inherited" data-et-surface-fill>
      ${button({ label: 'Cancel', variant: 'tonal', size: 'lg', class: 'et-action-sheet-cancel' }).replace(
        /^<button /,
        `<button ${mark('cancel', cancel)} `,
      )}
    </div>
  </div>`;

export default definePart({
  note: 'Inset card of icon and label rows, a tonal Cancel button below',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: {},
    'without-header': { header: false },
    'action-hover': { action: 'hover' },
    'action-active': { action: 'active' },
    'action-focus-visible': { action: 'focus-visible' },
    'cancel-focus-visible': { cancel: 'focus-visible' },
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
