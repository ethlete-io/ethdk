import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import { disclosure } from '@system/components/disclosure';
import disclosureStyles from '@system/components/disclosure.css?inline';
import shellMain from '@system/elements/shell-main';
import { icon } from '@system/foundations/icons';
import {
  CHANGED,
  TARGET,
  type Row,
  picked,
  rowCaption,
  rowStyles,
  shot,
  unchangedBody,
  unchangedLabel,
} from './merge-data';
import kit from './merge-kit.css?inline';
import styles from './merge.css?inline';

type Props = { unchanged: boolean };

const SCALE = 0.37;
const CROP_SCALE = 2;

const merge = await button.render({ label: 'Merge', variant: 'filled', size: 'sm' });
const ARROW = icon('arrow-left', { size: 14 });
const back = await button.render({ label: `${ARROW}<span>Back to sketch</span>`, variant: 'transparent', size: 'sm' });
const instance = await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' });

const selected = CHANGED[1];

const crop: Row = {
  part: 'pages/system',
  state: 'empty',
  instances: 1,
  width: 266,
  height: 64,
  body: html`<div class="flex items-center justify-center w-full h-full">${instance.body}</div>`,
};

const listRow = (row: Row) =>
  html`<li
    class="px-space-2 py-space-1 rounded-control-sm cursor-pointer data-selected:bg-accent-subtle"
    ${row === selected ? ' data-selected' : ''}
  >
    ${rowCaption(row, true)}
  </li>`;

const panelOf = (unchanged: boolean) =>
  html`<div class="flex flex-col gap-space-2 h-full box-border px-space-1 pt-space-1 pb-space-2">
    <div class="mg-d-back flex">${back.body}</div>
    <div class="flex flex-col gap-space-2 pb-space-3 border-b border-surface-border">
      <span class="font-code text-(length:--text-sm)">${TARGET.part}</span>
      <span class="flex items-center gap-space-2 text-text-muted text-ui-xs"
        >${picked(TARGET.variant)}<span>${TARGET.note}</span></span
      >
    </div>
    <span class="text-text-muted text-ui-xs">Changed</span>
    <ul class="flex flex-col gap-0.5 m-0 p-0 list-none">
      ${CHANGED.map(listRow).join('')}
    </ul>
    <div data-et-skip="WRAP">
      ${disclosure({ label: unchangedLabel, body: unchangedBody, open: unchanged, size: 'xs' })}
    </div>
    <span class="flex-1"></span>
    <div class="mg-d-merge flex flex-col gap-space-3 pt-space-3 border-t border-surface-border">${merge.body}</div>
  </div>`;

export default definePart<Props>({
  note: 'focus-visible nimmt --text wie hover',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [1440],
  states: {
    open: { unchanged: false },
    'unchanged-open': { unchanged: true },
  },
  controls: {
    toggle: { kind: 'disclosure', part: 'components/disclosure', surfaces: { body: 'unchanged-open' } },
  },
  render: async ({ unchanged }) => {
    const row = selected ?? CHANGED[0];
    const content = row
      ? html`<div class="mg-c-page flex flex-col gap-space-5 h-full box-border overflow-hidden">
          <header class="flex flex-col gap-space-1">
            <span class="text-ui-lg font-ui-strong">Where ${TARGET.name} is used</span>
            <span>${rowCaption(row)}</span>
          </header>
          <div class="flex gap-space-4">
            <figure class="flex flex-col gap-space-2 m-0">
              <figcaption class="text-text-muted text-ui-xs">Now</figcaption>
              ${shot(row, 'now', SCALE)}
            </figure>
            <figure class="flex flex-col gap-space-2 m-0">
              <figcaption class="text-text-muted text-ui-xs">
                After merging <code class="text-accent-text font-code">${TARGET.variant}</code>
              </figcaption>
              ${shot(row, 'after', SCALE)}
            </figure>
          </div>
          <div class="flex flex-col gap-space-2">
            <span class="text-text-muted text-ui-xs">Instance 1 of ${row.instances} · 200 %</span>
            <div class="flex gap-space-4">${shot(crop, 'now', CROP_SCALE)}${shot(crop, 'after', CROP_SCALE)}</div>
          </div>
        </div>`
      : '';

    const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: panelOf(unchanged), content });

    return drawing({
      body: shell.body,
      styles: shell.styles + back.styles + merge.styles + instance.styles + rowStyles + disclosureStyles + kit + styles,
    });
  },
});
