import { definePart, drawing, html, withAction } from '@design-system';
import button from '@system/components/button';
import select from '@system/components/select';
import switchPart from '@system/components/switch';
import badge from '@system/components/badge';
import { commentPinMark } from '@system/components/comment-pin';
import { holdTrigger } from '@system/components/hold-trigger';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import zoomChip from '@system/components/zoom-chip';
import disclosurePart, { disclosure } from '@system/components/disclosure';
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
  toggleHold,
} from '@shared/sketch-status';
import {
  PARTS,
  type PartKind,
  type Row,
  type RowKey,
  type SketchPart,
  type Zoom,
  cell,
  comparingMark,
  isSame,
  isTransposed,
  mountFit,
  prepareShots,
  rowHead,
  rowsOf,
  sameLabel,
  takeStyles,
  wrapColumns,
  withSame,
  wrapStage,
} from '@shared/sketch-rows';
import { type Withdrawn, isWithdrawn, visibleRows, withdrawnCount, withdrawnMark } from '@shared/withdrawn';
import { type Camera } from 'ethlete-studio/canvas';

type Props = {
  camera: 'fit' | '100' | Camera;
  selected?: RowKey;
  status?: SketchStatus;
  reason?: boolean;
  fresh?: boolean;
  part?: PartKind;
  comparing?: boolean;
  same?: RowKey[];
  sameOpen?: boolean;
  withdrawn?: Withdrawn;
};

type View = { selected?: RowKey; status: SketchStatus; comparing: boolean; withdrawn?: Withdrawn };

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

const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm', color: 'danger' });
const chip = await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' });
const pagePin = commentPinMark(pinProps(PAGE_PIN));

const pickerOf = async (label: string) => {
  const picker = await select.render({
    label: '',
    size: 'sm',
    value: 'round-1',
    options: [{ value: 'round-1', label }],
  });
  return {
    ...picker,
    body: withAction(picker.body, { action: 'emit:roundChange', on: '.et-select-trigger' }),
  };
};
const pickers = {
  wide: await pickerOf('Runde 1 · Suche und Update'),
  narrow: await pickerOf('Runde 1 · Reset control: SDK button or own part'),
};

const tag = async (label: string) =>
  (await badge.render({ badges: [{ label, variant: 'tonal', size: 'sm' }] })) as { body: string; styles: string };
const tags = {
  drawing: await tag(STATUS_LABEL.drawing),
  waiting: await tag(STATUS_LABEL.waiting),
  paused: await tag(STATUS_LABEL.paused),
  idle: await tag(STATUS_LABEL.idle),
  fresh: await tag('neu'),
};

const statusMarkup = (status: SketchStatus, reason: boolean) => {
  if (status === 'paused') {
    return html`<span class="flex min-w-0 items-center gap-space-2">
      ${holdTrigger({ content: tags.paused.body, open: reason, action: reason ? 'paused' : 'paused-reason' })}
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
  row.key === 'a'
    ? html`<span class="absolute top-space-1 right-space-1 z-1 flex in-data-sk-head-hidden:hidden">${pagePin}</span>`
    : '';

const headOf = (row: Row, view: View) => {
  const drawn = view.status === 'drawing' && row.key === DRAWN;
  const action = drawn ? drawingMark : view.status === 'waiting' ? undefined : '';
  const mark = view.comparing && row.key !== 'current' ? comparingMark : '';
  if (isWithdrawn(row, view.withdrawn)) return rowHead(row, withdrawnMark, mark);
  return rowHead(row, action, mark) + (drawn ? '' : pinFor(row));
};

const gridRow = (part: SketchPart, row: Row, view: View) => {
  const drawn = view.status === 'drawing' && row.key === DRAWN;
  return html`<section
    class="sk-row grid grid-cols-[var(--sk-head)_minmax(0,1fr)] gap-space-5 rounded-control-md p-space-3"
    data-sk-row="${row.key}"
    ${row.key === view.selected ? ' data-selected' : ''}
  >
    <div class="relative min-w-0">${headOf(row, view)}</div>
    <div class="min-w-0 ${isWithdrawn(row, view.withdrawn) ? 'opacity-60' : ''}">
      ${drawn ? drawingStage(row) : wrapStage(part, row, view.comparing)}
    </div>
  </section>`;
};

const sameToggle = (rows: Row[], open: boolean, body = '') =>
  withAction(
    disclosure({ label: sameLabel(rows), body, open, size: 'xs' }).replace(/ data-et-action="[^"]*"/, ''),
    'emit:sameToggle',
  );

const sameRows = (part: SketchPart, rows: Row[], view: View, open: boolean) =>
  rows.length === 0
    ? ''
    : html`<section class="sk-same rounded-control-md p-space-2" data-sk-same ${open ? 'data-open' : ''}>
        ${sameToggle(
          rows,
          open,
          html`<div class="flex flex-col gap-space-2 pt-space-2">
            ${rows.map((row) => gridRow(part, row, view)).join('')}
          </div>`,
        )}
      </section>`;

const gutter = (part: SketchPart, top: number) =>
  part.states
    .map(
      (state, index) =>
        html`<span
          class="sk-gutter relative z-2 flex items-center self-stretch bg-et-surface-bg pr-space-3 font-code text-(length:--sk-note) leading-[1.35] text-et-surface in-data-sk-head-hidden:text-transparent"
          data-sk-gutter
          style="grid-column: 1; grid-row: ${top + 1 + index * 2} / span 2"
          >${state}</span
        >`,
    )
    .join('');

const column = (part: SketchPart, row: Row, at: number, top: number, view: View) => {
  const drawn = view.status === 'drawing' && row.key === DRAWN;
  const head = html`<section
    class="sk-row relative min-w-0 rounded-control-md p-space-2"
    data-sk-row="${row.key}"
    style="grid-column: ${at}; grid-row: ${top}"
    ${row.key === view.selected ? ' data-selected' : ''}
  >
    ${headOf(row, view)}
  </section>`;
  const cells = drawn
    ? drawingStage(row, `grid-column: ${at}; grid-row: ${top + 1} / span ${part.states.length * 2}`)
    : part.states
        .map((state, index) =>
          cell(part, row, state, `grid-column: ${at}; grid-row: ${top + 1 + index * 2} / span 2`, view.comparing),
        )
        .join('');
  return head + cells;
};

const matrix = (part: SketchPart, shown: Row[], same: Row[], view: View, open: boolean) => {
  const top = same.length > 0 && open ? 2 : 1;
  const after = shown.length + 2;
  const group =
    same.length === 0
      ? ''
      : open
        ? html`<div
            class="sk-same self-end rounded-control-md"
            data-sk-same
            data-open
            style="grid-column: ${after} / span ${same.length}; grid-row: 1"
          >
            ${sameToggle(same, true)}
          </div>`
        : html`<div
            class="sk-same w-36 rounded-control-md p-space-1"
            data-sk-same
            data-et-skip="WRAP"
            style="grid-column: ${after}; grid-row: 1 / span ${part.states.length * 2 + 1}"
          >
            ${sameToggle(same, false)}
          </div>`;
  const all = open ? [...shown, ...same] : shown;
  return html`<div
    class="grid w-max grid-cols-[max-content_repeat(var(--sk-cols),var(--sk-frame))_auto] gap-x-6 gap-y-space-3"
    data-sk-matrix
  >
    ${gutter(part, top)} ${all.map((row, index) => column(part, row, index + 2, top, view)).join('')} ${group}
  </div>`;
};

const zoomOf = (camera: Props['camera']): Zoom => (camera === 'fit' ? 'fit' : camera === '100' ? 1 : camera.zoom);
const startOf = (camera: Props['camera']) => (typeof camera === 'object' ? { x: camera.x, y: camera.y } : undefined);

export default definePart<Props>({
  note: 'Eine Zeile je Variante, ganz oben Aktuell, bei einem neuen Teil ohne Aktuell und mit dem Badge neu. Links steht der Kopf: Variante, kurzer Modellname (Tooltip mit voller Kennung und Zeit), die Notiz und Übernehmen, das direkt die Merge-Ansicht öffnet; Übernehmen steht nur da, wenn der Sketch auf die Wahl wartet. Das Badge oben folgt dem echten Zustand: zeichnet, solange eine Variante gezeichnet wird, Wartet auf deine Wahl, wenn alle stehen, sonst Pausiert oder Keine Aktivität. Die Notiz wächst mit dem Zoom (15 px bei 100 %, nie unter 12 px bis Einpassen); weiter herausgezoomt skaliert der Kopf mit der Fläche, unter 9 px ist sein Text ausgeblendet. Rechts stehen die Zustände in einem Raster, jeder mit Namen (13 px mal Zoom, unter 9 px ausgeblendet). Ein Teil breiter als ein Viertel der Ansicht zeigt eine Matrix: eine Spalte je Variante, Aktuell zuerst, die Zustände als Zeilen, der Zustandsname einmal je Zeile links; beim Verschieben bleibt diese Spalte am linken Rand stehen. Einpassen nimmt Aktuell und die erste Variante, in der Matrix deren zwei Spalten; weitere erreicht man durch Verschieben. Solange der Vergleich läuft, sind alle Rahmen neutral und der Kopf zeigt vergleicht …; danach sind unveränderte Zustände gedimmt und der erste geänderte markiert. Varianten, die in jedem Zustand gleich Aktuell sind, liegen zusammen in einem zugeklappten Bereich unter den geänderten (in der Matrix eine schmale Spalte rechts), aufgeklappt wie vorher.',
  madeBy: ['claude-opus-5-5', 'gpt-6', 'claude-sonnet-5-5'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/sketches/sketches.component.ts' },
  controls: {
    canvas: { kind: 'field', part: 'components/canvas-viewport' },
    hold: { kind: 'button', part: 'components/hold-trigger' },
    toggle: { kind: 'button', input: ['pointer', 'keyboard'] },
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
    'sticky-names': { camera: { zoom: 0.8, x: -1700, y: -260 } },
    comparing: { camera: 'fit', comparing: true },
    'comparing-narrow': { camera: 'fit', part: 'narrow', comparing: true },
    'below-fit': { camera: { zoom: 0.25, x: 0, y: 0 } },
    'far-out': { camera: { zoom: 0.1, x: 0, y: 0 } },
    'narrow-below-fit': { camera: { zoom: 0.8, x: 0, y: 0 }, part: 'narrow' },
    'narrow-far-out': { camera: { zoom: 0.5, x: 0, y: 0 }, part: 'narrow' },
    unchanged: { camera: 'fit', part: 'narrow', same: ['b'] },
    'unchanged-open': { camera: 'fit', part: 'narrow', same: ['b'], sameOpen: true },
    'all-unchanged': { camera: 'fit', part: 'narrow', same: ['a', 'b'] },
    'unchanged-matrix': { camera: { zoom: 0.25, x: -4000, y: 0 }, same: ['b', 'c'] },
    'unchanged-matrix-open': { camera: { zoom: 0.25, x: -4000, y: 0 }, same: ['b', 'c'], sameOpen: true },
    'withdrawn-hidden': { camera: 'fit', part: 'narrow', withdrawn: 'hidden' },
    'withdrawn-shown': { camera: 'fit', part: 'narrow', withdrawn: 'shown' },
  },
  render: async ({
    camera,
    selected,
    status = 'waiting',
    reason = false,
    fresh = false,
    part: kind = 'wide',
    comparing = false,
    same: sameKeys = [],
    sameOpen = false,
    withdrawn,
  }) => {
    const part = withSame(PARTS[kind], comparing ? [] : sameKeys);
    const rowStyles = await prepareShots(part);
    const side = await treeOf(part.key.replace('components/', ''));
    const all = rowsOf(part, fresh);
    const rows = visibleRows(all, withdrawn);
    const hiddenCount = withdrawnCount(all, withdrawn);
    const same = comparing ? [] : rows.filter(isSame);
    const shown = rows.filter((row) => !same.includes(row));
    const view: View = { selected, status, comparing, withdrawn };
    const showWithdrawn =
      hiddenCount > 0
        ? ((await switchPart.render({
            label: `Zurückgezogene (${hiddenCount})`,
            size: 'sm',
            checked: withdrawn === 'shown',
          })) as { body: string; styles: string })
        : { body: '', styles: '' };
    const transposed = isTransposed(part, LIST_WIDTH);
    const columns = transposed && sameOpen ? rows.length : shown.length;
    const world = transposed
      ? matrix(part, shown, same, view, sameOpen)
      : shown.map((row) => gridRow(part, row, view)).join('') + sameRows(part, same, view, sameOpen);
    const toggle = await disclosurePart.render({ label: '', body: '', open: false });
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
        ${withAction(discard.body, 'emit:discard')}
      </header>
      <div
        class="zr-picker absolute z-2 top-14 left-[calc(var(--st-shell-inset-left)+var(--space-5))] flex items-center gap-space-4"
      >
        ${pickers[kind].body}
        ${showWithdrawn.body ? withAction(showWithdrawn.body, { action: 'emit:withdrawnToggle', on: '.et-switch' }) : ''}
      </div>
      <div
        class="absolute top-27 right-space-5 bottom-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))] overflow-clip [overflow-clip-margin:4px]"
        data-sk-rows
      >
        <div
          class="flex flex-col gap-space-2 pb-16 ${transposed ? 'w-max' : ''}"
          data-sk-rows-world
          data-w="${part.width}"
          data-cols="${transposed ? columns : wrapColumns(part)}"
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
        showWithdrawn.styles +
        (toggle as { styles: string }).styles +
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
