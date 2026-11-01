import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import { disclosure } from '@system/components/disclosure';
import disclosureStyles from '@system/components/disclosure.css?inline';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
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

type Props = { unchanged: boolean; error?: string };

const SCALE = 0.37;
const CROP_SCALE = 2;

const merge = await button.render({ label: 'Merge', variant: 'filled', size: 'sm' });
const ARROW = icon('arrow-left', { size: 14 });
const back = await button.render({
  label: `${ARROW}<span>Zurück zum Sketch</span>`,
  variant: 'transparent',
  size: 'sm',
});
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
    class="px-space-2 py-space-1 rounded-control-sm cursor-pointer data-selected:bg-et-theme/20"
    data-et-control="row"
    ${row === selected ? ' data-selected' : ''}
  >
    ${rowCaption(row, true)}
  </li>`;

const ERROR = `${TARGET.part} hat sich seit dem Sketch geändert. Lass deinen Agent den Sketch rebasen.`;

const panelOf = (unchanged: boolean, error: string) =>
  html`<div class="flex flex-col gap-space-2 h-full box-border px-space-1 pt-space-1 pb-space-2">
    <div class="mg-d-back flex">${back.body}</div>
    <div class="flex flex-col gap-space-2 pb-space-3 border-b border-et-surface-border">
      <span class="font-code text-(length:--text-sm)">${TARGET.part}</span>
      <span class="flex items-center gap-space-2 text-et-surface-muted text-ui-xs"
        >${picked(TARGET.variant)}<span>${TARGET.note}</span></span
      >
    </div>
    <span class="text-et-surface-muted text-ui-xs">Geändert</span>
    <ul class="flex flex-col gap-0.5 m-0 p-0 list-none">
      ${CHANGED.map(listRow).join('')}
    </ul>
    <div data-et-skip="WRAP">
      ${disclosure({ label: unchangedLabel, body: unchangedBody, open: unchanged, size: 'xs' })}
    </div>
    <span class="flex-1"></span>
    <div class="flex flex-col gap-space-3 pt-space-3 border-t border-et-surface-border">
      ${merge.body}${error ? html`<p class="m-0 text-et-theme-ink text-ui-xs" data-et-semantic-color="error">${error}</p>` : ''}
    </div>
  </div>`;

export default definePart<Props>({
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/merge/merge.component.ts' },
  note: 'focus-visible nimmt --text wie hover',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  widths: [1440],
  states: {
    open: { unchanged: false },
    'unchanged-open': { unchanged: true },
    'merge-error': { unchanged: false, error: ERROR },
  },
  controls: {
    toggle: { kind: 'disclosure', part: 'components/disclosure', surfaces: { body: 'unchanged-open' } },
    row: { kind: 'row', input: ['pointer'] },
  },
  render: async ({ unchanged, error = '' }) => {
    const row = selected ?? CHANGED[0];
    const content = row
      ? html`<div class="mg-c-page flex flex-col gap-space-5 h-full box-border overflow-hidden">
          <header class="flex flex-col gap-space-1">
            <span class="text-ui-lg font-ui-strong">Wo ${TARGET.name} vorkommt</span>
            <span>${rowCaption(row)}</span>
          </header>
          <div class="flex gap-space-4">
            <figure class="flex flex-col gap-space-2 m-0">
              <figcaption class="text-et-surface-muted text-ui-xs">Jetzt</figcaption>
              ${shot(row, 'now', SCALE)}
            </figure>
            <figure class="flex flex-col gap-space-2 m-0">
              <figcaption class="text-et-surface-muted text-ui-xs">
                Nach dem Merge von <code class="text-et-theme-ink font-code">${TARGET.variant}</code>
              </figcaption>
              ${shot(row, 'after', SCALE)}
            </figure>
          </div>
          <div class="flex flex-col gap-space-2">
            <span class="text-et-surface-muted text-ui-xs">Instanz 1 von ${row.instances} · 200 %</span>
            <div class="flex gap-space-4">
              ${shot(crop, 'now', CROP_SCALE, false)}${shot(crop, 'after', CROP_SCALE, false)}
            </div>
          </div>
        </div>`
      : '';

    const menu = await studioMenu({ open: false });

    const shell = await shellMain.render({
      studio: menu.body,
      section: 'Sketches',
      product: 'studio',
      side: panelOf(unchanged, error),
      content,
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles:
        shell.styles +
        menu.styles +
        back.styles +
        merge.styles +
        instance.styles +
        rowStyles +
        disclosureStyles +
        kit +
        styles,
    });
  },
});
