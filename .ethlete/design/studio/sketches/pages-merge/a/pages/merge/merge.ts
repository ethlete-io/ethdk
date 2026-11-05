import { definePart, drawing, html, slot, withAction } from '@design-system';
import { loaderStyles } from '@ethlete/components/design/loader';
import button from '@system/components/button';
import { disclosure } from '@system/components/disclosure';
import { listRow } from '@system/components/list-row';
import disclosureStyles from '@system/components/disclosure.css?inline';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import { icon } from '@system/foundations/icons';
import { TARGET, changedOf, type Row, picked, rowCaption, shot, unchangedBody, unchangedLabel } from './merge-data';
import kit from './merge-kit.css?inline';
import styles from './merge.css?inline';

type Props = { unchanged: boolean; error?: string; selected?: number; merging?: boolean };

const SCALE = 0.37;
const CROP_SCALE = 2;

const ARROW = icon('arrow-left', { size: 14 });

const buttonsOf = async () => ({
  merge: await button.render({ label: 'Merge', variant: 'filled', size: 'sm' }),
  mergeBusy: await button.render({ label: 'Merge', variant: 'filled', size: 'sm', loading: true }),
  back: await button.render({
    label: `${ARROW}<span>Zurück zum Sketch</span>`,
    variant: 'transparent',
    size: 'sm',
  }),
  instance: await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' }),
});

type Buttons = Awaited<ReturnType<typeof buttonsOf>>;

const cropRowOf = (instance: string): Row => ({
  part: 'pages/system',
  state: 'empty',
  instances: 1,
  width: 266,
  height: 64,
  body: html`<div class="contents" ${slot('crop')}>
    <div class="flex items-center justify-center w-full h-full" data-et-demo>${instance}</div>
  </div>`,
});

const cropOf = (row: Row, side: 'now' | 'after', crop: Row) =>
  shot(row.missing === side ? { ...crop, body: '' } : crop, side, CROP_SCALE, false);

const addedShot = (row: Row) =>
  html`<div
    class="mg-shot flex flex-none items-center justify-center rounded-control-md text-ui-sm text-et-surface-muted"
    data-side="now"
    style="--mg-scale: ${SCALE}; --mg-w: ${row.width}px; --mg-h: ${row.height}px"
  >
    Neu in ${TARGET.variant}
  </div>`;

const ERROR = `${TARGET.part} hat sich seit dem Sketch geändert. Lass deinen Agent den Sketch rebasen.`;

const panelOf = (
  buttons: Buttons,
  changed: Row[],
  unchanged: boolean,
  error: string,
  selected: Row,
  merging: boolean,
) =>
  html`<div class="flex flex-col gap-space-2 h-full box-border px-space-1 pt-space-1 pb-space-2">
    <div class="mg-d-back flex">${withAction(buttons.back.body, 'emit:back')}</div>
    <div class="flex flex-col gap-space-2 pb-space-3 border-b border-et-surface-border">
      <span class="font-code text-(length:--text-sm)">${TARGET.part}</span>
      <span class="flex items-center gap-space-2 text-et-surface-muted text-ui-xs"
        >${picked(TARGET.variant)}<span>${TARGET.note}</span></span
      >
    </div>
    <span class="text-et-surface-muted text-ui-xs">Geändert</span>
    <ul class="flex flex-col gap-0.5 m-0 p-0 list-none">
      ${changed.map((row) => listRow({ content: rowCaption(row, true), selected: row === selected })).join('')}
    </ul>
    <div data-et-skip="WRAP">
      ${disclosure({ label: unchangedLabel, body: unchangedBody, open: unchanged, size: 'xs' })}
    </div>
    <span class="flex-1"></span>
    <div class="flex flex-col gap-space-3 pt-space-3 border-t border-et-surface-border">
      ${withAction(merging ? buttons.mergeBusy.body : buttons.merge.body, 'emit:merge')}${error ? html`<p class="m-0 text-et-theme-ink text-ui-xs" data-et-semantic-color="error">${error}</p>` : ''}
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
    added: { unchanged: false, selected: 2 },
    merging: { unchanged: false, merging: true },
  },
  controls: {
    toggle: { kind: 'disclosure', part: 'components/disclosure', surfaces: { body: 'unchanged-open' } },
    row: { kind: 'row', part: 'components/list-row' },
  },
  render: async ({ unchanged, error = '', selected = 1, merging = false }) => {
    const changed = await changedOf();
    const buttons = await buttonsOf();
    const crop = cropRowOf(buttons.instance.body);
    const row = changed.rows[selected] ?? changed.rows[0];
    const content = row
      ? html`<div class="mg-c-page flex flex-col gap-space-5 h-full box-border overflow-hidden">
          <header class="flex flex-col gap-space-1">
            <span class="text-ui-lg font-ui-strong">Wo ${TARGET.name} vorkommt</span>
            <span>${rowCaption(row)}</span>
          </header>
          <div class="flex gap-space-4">
            <figure class="flex flex-col gap-space-2 m-0">
              <figcaption class="text-et-surface-muted text-ui-xs">Jetzt</figcaption>
              ${row.missing === 'now' ? addedShot(row) : shot(row, 'now', SCALE)}
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
            <div class="flex gap-space-4">${cropOf(row, 'now', crop)}${cropOf(row, 'after', crop)}</div>
          </div>
        </div>`
      : '';

    const menu = await studioMenu({ open: false });

    const shell = await shellMain.render({
      studio: menu.body,
      section: 'Sketches',
      product: 'studio',
      side: row ? panelOf(buttons, changed.rows, unchanged, error, row, merging) : '',
      content,
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles:
        shell.styles +
        menu.styles +
        buttons.back.styles +
        buttons.merge.styles +
        buttons.instance.styles +
        loaderStyles +
        changed.styles +
        disclosureStyles +
        kit +
        styles,
    });
  },
});
