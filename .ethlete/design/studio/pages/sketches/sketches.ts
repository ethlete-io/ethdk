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
  PARTS,
  type PartKind,
  type Row,
  type RowKey,
  type SketchPart,
  type Zoom,
  cell,
  isTransposed,
  mountFit,
  prepareShots,
  rowHead,
  rowsOf,
  takeStyles,
  wrapColumns,
  wrapStage,
} from './shared/sketch-rows';
import { type Camera } from 'ethlete-studio/canvas';

type Props = {
  camera: 'fit' | '100' | Camera;
  selected?: RowKey;
  status?: SketchStatus;
  reason?: boolean;
  fresh?: boolean;
  part?: PartKind;
};

const DRAWN: RowKey = 'b';

const LIST_WIDTH = 1100;

const treeOf = (selected: string) =>
  partTree.render({
    layers: [
      {
        title: 'Components',
        open: true,
        parts: Object.values(PARTS)
          .map((entry) => entry.key.replace('components/', ''))
          .map((name) => ({
            name,
            leaf: true,
            ...(name === selected ? { selected: true } : {}),
          })),
      },
      { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true }] },
    ],
  });
const act = (markup: string, action: string) => markup.replace(/<button\b/, `<button data-et-action="emit:${action}"`);

const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm', color: 'danger' });
const chip = await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' });
const pagePin = act(commentPinMark(pinProps(PAGE_PIN)), 'pinToggle');

const pickerOf = (label: string) =>
  select.render({ label: '', size: 'sm', value: 'round-1', options: [{ value: 'round-1', label }] });
const pickers = {
  wide: await pickerOf('Runde 1 · Suche und Update'),
  narrow: await pickerOf('Runde 1 · Reset control: SDK button or own part'),
};

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

const drawingStage = (row: Row, place = '') =>
  html`<div
    class="sk-shot flex min-h-24 items-center justify-center rounded-control-md"
    data-sk-placeholder-row
    style="${place}"
  >
    ${row.model ? drawingPlaceholder({ name: row.model.short, agent: row.model.agent }) : ''}
  </div>`;

const pinFor = (row: Row) =>
  row.key === 'a' ? html`<span class="absolute top-space-1 right-space-1 z-1 flex">${pagePin}</span>` : '';

const gridRow = (part: SketchPart, row: Row, selected: boolean, status?: SketchStatus) => {
  const drawn = status === 'drawing' && row.key === DRAWN;
  return html`<section
    class="sk-row grid grid-cols-[var(--sk-head)_minmax(0,1fr)] gap-space-5 rounded-control-md p-space-3"
    data-sk-row="${row.key}"
    ${selected ? ' data-selected' : ''}
  >
    <div class="relative min-w-0">${rowHead(row, drawn ? drawingMark : undefined)} ${drawn ? '' : pinFor(row)}</div>
    <div class="min-w-0">${drawn ? drawingStage(row) : wrapStage(part, row)}</div>
  </section>`;
};

const line = (index: number) => `${2 + index * 2} / span 2`;

const gutter = (part: SketchPart) =>
  part.states
    .map(
      (state, index) =>
        html`<span
          class="hidden self-center in-data-sk-labels-hidden:block font-code text-(length:--sk-note) leading-[1.35] text-et-surface"
          data-sk-gutter
          style="grid-column: 1; grid-row: ${3 + index * 2}"
          >${state}</span
        >`,
    )
    .join('');

const matrix = (part: SketchPart, rows: Row[], selected: RowKey | undefined, status?: SketchStatus) =>
  html`<div
    class="grid w-max grid-cols-[max-content_repeat(var(--sk-cols),var(--sk-frame))] gap-x-6 gap-y-space-3"
    data-sk-matrix
  >
    ${gutter(part)}
    ${rows
      .map((row, index) => {
        const column = index + 2;
        const drawn = status === 'drawing' && row.key === DRAWN;
        const head = html`<section
          class="sk-row relative row-start-1 min-w-0 rounded-control-md p-space-2"
          data-sk-row="${row.key}"
          style="grid-column: ${column}"
          ${row.key === selected ? ' data-selected' : ''}
        >
          ${rowHead(row, drawn ? drawingMark : undefined)} ${drawn ? '' : pinFor(row)}
        </section>`;
        const cells = drawn
          ? drawingStage(row, `grid-column: ${column}; grid-row: 2 / span ${part.states.length * 2}`)
          : part.states
              .map((state, at) => cell(part, row, state, `grid-column: ${column}; grid-row: ${line(at)}`))
              .join('');
        return head + cells;
      })
      .join('')}
  </div>`;

const zoomOf = (camera: Props['camera']): Zoom => (camera === 'fit' ? 'fit' : camera === '100' ? 1 : camera.zoom);
const startOf = (camera: Props['camera']) => (typeof camera === 'object' ? { x: camera.x, y: camera.y } : undefined);

export default definePart<Props>({
  note: 'Eine Zeile je Variante, ganz oben Aktuell, bei einem neuen Teil ohne Aktuell und mit dem Badge neu. Links steht der Kopf: Variante, kurzer Modellname (Tooltip mit voller Kennung und Zeit), die Notiz und Übernehmen, das direkt die Merge-Ansicht öffnet. Die Notiz wächst mit dem Zoom (15 px bei 100 %, nie unter 12 px), die Kopfspalte wächst mit ihr. Rechts stehen die Zustände in einem Raster, jeder mit Namen (13 px mal Zoom, unter 9 px ausgeblendet); ein Name darf zweizeilig umbrechen, jede Rasterzeile hält die Höhe ihres höchsten Namens, so beginnen alle Rahmen einer Zeile oben gleich. Ein Teil breiter als ein Viertel der Ansicht zeigt eine Matrix: eine Spalte je Variante, Aktuell zuerst, die Zustände als Zeilen; links steht der Zustandsname einmal je Zeile in 12 px, sobald die Namen in den Zellen ausgeblendet sind. Einpassen nimmt die kleinste aus 100 %, der Breite und der Höhe von Aktuell und erster Variante; in der Matrix die Breite aller Spalten. Unveränderte Zustände sind gedimmt, der erste geänderte ist markiert.',
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
    'narrow-part': { camera: 'fit', part: 'narrow' },
  },
  render: async ({ camera, selected, status, reason = false, fresh = false, part: kind = 'wide' }) => {
    const part = PARTS[kind];
    const rowStyles = await prepareShots(part);
    const side = await treeOf(part.key.replace('components/', ''));
    const rows = rowsOf(part, fresh);
    const transposed = isTransposed(part, LIST_WIDTH);
    const world = transposed
      ? matrix(part, rows, selected, status)
      : rows.map((row) => gridRow(part, row, row.key === selected, status)).join('');
    const content = html`<div
      class="relative isolate box-border flex h-full flex-col gap-space-4 overflow-hidden p-space-5 pl-[calc(var(--st-shell-inset-left,0px)+var(--space-5))]"
      data-sketches-page
      data-et-skip="CLIPPED"
    >
      <header
        class="absolute z-3 top-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))] right-space-5 flex items-center gap-space-3"
      >
        <span class="text-ui-lg font-ui-strong">${part.key}</span>
        ${fresh ? tags.fresh.body : ''} ${statusMarkup(status, reason)}
        <span class="flex-1"></span>
        <span class="w-56 flex-none" data-sk-view-toggle-room></span>
        ${act(discard.body, 'discard')}
      </header>
      <div class="zr-picker absolute z-2 top-14 left-[calc(var(--st-shell-inset-left)+var(--space-5))]">
        ${pickers[kind].body}
      </div>
      <div
        class="absolute top-27 right-space-5 bottom-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))]"
        data-sk-rows
      >
        <div
          class="flex flex-col gap-space-2 pb-16 ${transposed ? 'w-max' : ''}"
          data-sk-rows-world
          data-w="${part.width}"
          data-cols="${transposed ? rows.length : wrapColumns(part)}"
        >
          ${world}
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
          mountFit(root, zoomOf(camera), startOf(camera));
        },
        toggleHold,
      ],
      styles:
        shell.styles +
        menu.styles +
        side.styles +
        discard.styles +
        pickers.wide.styles +
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
