import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import select from '@system/components/select';
import badge from '@system/components/badge';
import { commentPinMark } from '@system/components/comment-pin';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import zoomChip from '@system/components/zoom-chip';
import { PAGE_PIN, pinProps } from './sketch-data';
import kit from './sketch-data.css?inline';
import styles from './sketches.css?inline';
import below from './below.css?inline';
import {
  HOLD,
  IDLE,
  STATUS_LABEL,
  type SketchStatus,
  drawingPlaceholder,
  modelName,
  holdTrigger,
  toggleHold,
} from './shared/sketch-status';
import {
  NEW_ROWS,
  ROWS,
  ROW_PART,
  SHOWN_STATES,
  type Row,
  type RowKey,
  type ShownState,
  type Zoom,
  firstChanged,
  fitFrame,
  mountFit,
  rowHead,
  prepareShots,
  takeStyles,
} from './shared/sketch-rows';
import { type Camera } from 'ethlete-studio/canvas';

type Props = {
  camera: 'fit' | '100' | Camera;
  selected?: RowKey;
  status?: SketchStatus;
  reason?: boolean;
  fresh?: boolean;
};

const DRAWN: RowKey = 'b';

const side = await partTree.render({
  layers: [
    { title: 'Components', open: true, parts: [{ name: 'title-bar', leaf: true, selected: true }] },
    { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true }] },
  ],
});
const act = (markup: string, action: string) => markup.replace(/<button\b/, `<button data-et-action="emit:${action}"`);

const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm', color: 'danger' });
const chip = await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' });
const pagePin = act(commentPinMark(pinProps(PAGE_PIN)), 'pinToggle');

const picker = await select.render({
  label: '',
  size: 'sm',
  value: 'round-1',
  options: [{ value: 'round-1', label: 'Runde 1 · Suche und Update' }],
});

const tag = async (label: string) =>
  (await badge.render({ badges: [{ label, variant: 'tonal', size: 'sm' }] })) as { body: string; styles: string };
const tags = {
  drawing: await tag(STATUS_LABEL.drawing),
  paused: await tag(STATUS_LABEL.paused),
  idle: await tag(STATUS_LABEL.idle),
  fresh: await tag('neu'),
};

const statusMarkup = (status: SketchStatus | undefined, reason: boolean) => {
  if (!status) return '';
  if (status === 'paused') {
    return html`<span class="flex min-w-0 items-center gap-space-2">
      ${holdTrigger(`${tags.paused.body}`, `flex cursor-pointer border-0 bg-transparent p-0`, reason)}
      <span
        class="flex min-w-0 items-center gap-space-2 text-ui-sm text-et-surface-muted whitespace-nowrap"
        data-sk-hold-reason
        ${reason ? '' : 'hidden'}
      >
        <span class="font-ui-medium text-et-surface">Wartet auf ${HOLD.until}</span>
        <span>·</span>${modelName(HOLD.by)}<span>· ${HOLD.since}</span>
      </span>
    </span>`;
  }
  const after =
    status === 'idle'
      ? html`<span class="text-ui-sm text-et-surface-muted whitespace-nowrap">${IDLE.last} · ${IDLE.since}</span>`
      : '';
  return html`<span class="flex items-center gap-space-2">${tags[status].body} ${after}</span>`;
};

const drawingMark = html`<span class="flex items-center gap-space-1 text-ui-sm text-et-surface-muted"
  ><span class="size-1.5 animate-pulse rounded-full bg-(--et-theme-color-primary-solid)"></span>zeichnet</span
>`;

const drawingStage = (row: Row) =>
  html`<div class="sk-shot flex min-h-24 items-center justify-center rounded-control-md" data-sk-placeholder-row>
    ${row.model ? drawingPlaceholder({ name: row.model.short, agent: row.model.agent }) : ''}
  </div>`;

const pinFor = (row: Row) =>
  row.key === 'a' ? html`<span class="absolute top-space-1 right-space-1 z-1 flex">${pagePin}</span>` : '';

const stateLabel = (row: Row, state: ShownState) =>
  html`<span
    class="font-code text-ui-xs ${row.changed.includes(state) || row.key === 'current' ? 'text-et-surface' : 'text-et-surface-muted'}"
    >${state}${row.key !== 'current' && !row.changed.includes(state) ? ' · unverändert' : ''}</span
  >`;

const stage = (row: Row) =>
  html`<div class="flex min-w-0 flex-col gap-space-3">
    ${SHOWN_STATES.map((state) => {
      const same = row.key !== 'current' && !row.changed.includes(state);
      const first = row.key !== 'current' && state === firstChanged(row);
      return html`<div class="flex flex-col gap-space-1 ${same ? 'opacity-50' : ''}">
        <span class="flex items-center gap-space-2"
          >${stateLabel(row, state)}${
            first ? html`<span class="text-ui-xs font-ui-medium text-et-surface">erste Änderung</span>` : ''
          }</span
        >
        ${fitFrame(row, state)}
      </div>`;
    }).join('')}
  </div>`;

const rowMarkup = (row: Row, selected: boolean, status?: SketchStatus) => {
  const drawn = status === 'drawing' && row.key === DRAWN;
  return html`<section
    class="sk-row grid grid-cols-[18rem_minmax(0,1fr)] gap-space-5 rounded-control-md p-space-3"
    data-sk-row="${row.key}"
    ${selected ? ' data-selected' : ''}
  >
    ${rowHead(row, drawn ? drawingMark : undefined)}
    <div class="relative min-w-0">${drawn ? drawingStage(row) : stage(row)} ${drawn ? '' : pinFor(row)}</div>
  </section>`;
};

const zoomOf = (camera: Props['camera']): Zoom => (camera === 'fit' ? 'fit' : camera === '100' ? 1 : camera.zoom);

export default definePart<Props>({
  note: 'Eine Zeile je Variante, ganz oben Aktuell, bei einem neuen Teil ohne Aktuell und mit dem Badge neu. Links steht der Kopf: Variante, kurzer Modellname (Tooltip mit voller Kennung und Zeit), die volle Notiz in text-ui-sm und Übernehmen, das direkt die Merge-Ansicht öffnet. Rechts stehen alle Zustände untereinander, jeder mit Namen, aus der Teilgröße gefittet und bei jeder Größenänderung neu; unveränderte sind gedimmt, der erste geänderte ist markiert. Der Zoom-Chip schaltet zwischen Einpassen und festen Stufen.',
  madeBy: ['claude-opus-5-5', 'gpt-6', 'claude-sonnet-5-5'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/sketches/sketches.component.ts' },
  controls: {
    canvas: { kind: 'field', part: 'components/canvas-viewport' },
    hold: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  states: {
    'page-sketch': { camera: 'fit' },
    'page-100': { camera: '100' },
    'zoomed-page': { camera: { zoom: 0.6, x: -853.2, y: 44 }, selected: 'a' },
    drawing: { camera: 'fit', status: 'drawing' },
    paused: { camera: 'fit', status: 'paused' },
    'paused-reason': { camera: 'fit', status: 'paused', reason: true },
    idle: { camera: 'fit', status: 'idle' },
    'new-part': { camera: 'fit', fresh: true },
  },
  render: async ({ camera, selected, status, reason = false, fresh = false }) => {
    const rowStyles = await prepareShots();
    const rows = fresh ? NEW_ROWS : ROWS;
    const content = html`<div
      class="relative isolate box-border flex h-full flex-col gap-space-4 overflow-hidden p-space-5 pl-[calc(var(--st-shell-inset-left,0px)+var(--space-5))]"
      data-sketches-page
      data-et-skip="CLIPPED"
    >
      <header
        class="absolute z-3 top-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))] right-space-5 flex items-center gap-space-3"
      >
        <span class="text-ui-lg font-ui-strong">${ROW_PART.key}</span>
        ${fresh ? tags.fresh.body : ''} ${statusMarkup(status, reason)}
        <span class="flex-1"></span>
        <span class="w-56 flex-none" data-sk-view-toggle-room></span>
        ${act(discard.body, 'discard')}
      </header>
      <div class="zr-picker absolute z-2 top-14 left-[calc(var(--st-shell-inset-left)+var(--space-5))]">
        ${picker.body}
      </div>
      <div
        class="absolute top-27 right-space-5 bottom-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))]"
        data-sk-rows
      >
        <div class="flex flex-col gap-space-2 pb-16" data-sk-rows-world>
          ${rows.map((row) => rowMarkup(row, row.key === selected, status)).join('')}
        </div>
      </div>
      ${chip.body}
    </div>`;

    const menu = await studioMenu({ open: false });

    const shell = await shellMain.render({
      studio: menu.body,
      section: 'Sketches',
      product: 'studio',
      side: side.body,
      content,
    });

    return drawing({
      body: shell.body,
      setup: [
        menu.setup,
        (root: HTMLElement) => {
          mountFit(root, zoomOf(camera));
        },
        toggleHold,
      ],
      styles:
        shell.styles +
        menu.styles +
        side.styles +
        discard.styles +
        picker.styles +
        takeStyles +
        rowStyles +
        Object.values(tags)
          .map((entry) => entry.styles)
          .join('') +
        kit +
        styles +
        below,
    });
  },
});
