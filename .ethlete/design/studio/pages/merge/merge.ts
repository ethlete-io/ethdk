import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import shellMain from '@system/elements/shell-main';
import {
  CHANGED,
  TARGET,
  type Row,
  type UnchangedState,
  picked,
  rowCaption,
  rowStyles,
  shot,
  unchangedLine,
} from './merge-data';
import kit from './merge-kit.css?inline';
import styles from './merge.css?inline';

type Props = { unchanged: UnchangedState };

const SCALE = 0.37;
const CROP_SCALE = 2;

const merge = await button.render({ label: 'Merge', variant: 'filled', size: 'sm' });
const ARROW =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>';
const back = await button.render({ label: `${ARROW}<span>Back to sketch</span>`, variant: 'transparent', size: 'sm' });
const instance = await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' });

const selected = CHANGED[1];

const crop: Row = {
  part: 'pages/system',
  state: 'empty',
  instances: 1,
  width: 266,
  height: 64,
  body: html`<div class="mg-c-crop">${instance.body}</div>`,
};

const listRow = (row: Row) =>
  html`<li class="mg-c-item" ${row === selected ? ' data-selected' : ''}>${rowCaption(row)}</li>`;

const panelOf = (unchanged: UnchangedState) =>
  html`<div class="mg-c-panel">
    <div class="mg-d-back">${back.body}</div>
    <div class="mg-c-target">
      <span class="mg-c-target-part">${TARGET.part}</span>
      <span class="mg-c-target-variant">${picked(TARGET.variant)}<span>${TARGET.note}</span></span>
    </div>
    <span class="mg-c-label">Changed</span>
    <ul class="mg-c-list">
      ${CHANGED.map(listRow).join('')}
    </ul>
    <div data-et-skip="WRAP">${unchangedLine(unchanged)}</div>
    <span class="mg-c-gap"></span>
    <div class="mg-c-merge mg-d-merge">${merge.body}</div>
  </div>`;

export default definePart<Props>({
  note: 'focus-visible nimmt --text wie hover',
  madeBy: ['claude-opus-5-5'],
  widths: [1440],
  states: {
    open: { unchanged: 'rest' },
    'unchanged-hover': { unchanged: 'hover' },
    'unchanged-focus': { unchanged: 'focus-visible' },
    'unchanged-open': { unchanged: 'open' },
  },
  controls: {
    unchanged: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'unchanged-open' } },
  },
  render: async ({ unchanged }) => {
    const row = selected ?? CHANGED[0];
    const content = row
      ? html`<div class="mg-c-page">
          <header class="mg-c-head">
            <span class="mg-c-heading">Where ${TARGET.name} is used</span>
            <span>${rowCaption(row)}</span>
          </header>
          <div class="mg-c-pair">
            <figure class="mg-c-frame">
              <figcaption>Now</figcaption>
              ${shot(row, 'now', SCALE)}
            </figure>
            <figure class="mg-c-frame">
              <figcaption>After merging <code>${TARGET.variant}</code></figcaption>
              ${shot(row, 'after', SCALE)}
            </figure>
          </div>
          <div class="mg-c-instances">
            <span class="mg-c-label">Instance 1 of ${row.instances} · 200 %</span>
            <div class="mg-c-pair">${shot(crop, 'now', CROP_SCALE)}${shot(crop, 'after', CROP_SCALE)}</div>
          </div>
        </div>`
      : '';

    const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: panelOf(unchanged), content });

    return drawing({
      body: shell.body,
      styles: shell.styles + back.styles + merge.styles + instance.styles + rowStyles + kit + styles,
    });
  },
});
