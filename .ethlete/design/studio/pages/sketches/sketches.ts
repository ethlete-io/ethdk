import { definePart, drawing, html, withAction } from '@design-system';
import {
  commentDraftAt,
  commentLayer,
  commentList,
  commentPins,
  draftPin,
  type CommentPhase,
  type PlacedThread,
  withCommentList,
} from '@system/components/comment-flow';
import anchoredDialog from '@system/components/anchored-dialog';
import button from '@system/components/button';
import { icon } from '@system/foundations/icons';
import { commentPinMark } from '@system/components/comment-pin';
import { type SketchHeadStatus, sketchHead } from '@system/components/sketch-head';
import { variantCell, variantCellStyles } from '@system/elements/variant-cell';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import zoomChip from '@system/components/zoom-chip';
import { canvasViewport, canvasViewportStyles } from '@system/components/canvas-viewport';
import { liveBadge } from '@system/elements/canvas-frames';
import disclosurePart, { disclosure } from '@system/components/disclosure';
import { PAGE_PIN, pinProps } from './sketch-data';
import kit from './sketch-data.css?inline';
import styles from './sketches.css?inline';
import { AGENT_RUNS, type AgentRun } from './shared/sketch-status';
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
  blockSizesOf,
  prepareShots,
  rowHead,
  rowsOf,
  sameLabel,
  takeAction,
  takeButton,
  unchangedStates,
  wrapColumns,
  withSame,
  wrapStage,
} from './shared/sketch-rows';
import { SKETCH_POINTS, openLabel } from './shared/open-points';
import { type Withdrawn, isWithdrawn, visibleRows, withdrawnCount, withdrawnMark } from './shared/withdrawn';
import { type MultiTargets, targetsOf } from './shared/multi-part';
import { type Camera } from 'ethlete-studio/canvas';
import {
  type ChangeGroup,
  GROUPS,
  SCREEN_KEY,
  SCREEN_HEIGHT,
  SCREEN_ROWS,
  SCREEN_WIDTH,
  UNCHANGED_COUNT,
  cropOf,
  cropShot,
  markedScreen,
  reasonLinesOf,
  screenOf,
  zoomTextOf,
} from './shared/change-crop';
import { SKETCHES_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';
import { BUILD_READY_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

type SketchStatus = SketchHeadStatus;

type ScreenMode = 'crop' | 'whole';

type Props = {
  camera: 'fit' | '100' | Camera;
  selected?: RowKey;
  status?: SketchStatus;
  failures?: Partial<Record<RowKey, string>>;
  errored?: RowKey[];
  fresh?: boolean;
  autoMerge?: boolean;
  part?: PartKind;
  comparing?: boolean;
  listError?: string;
  empty?: boolean;
  known?: string[];
  added?: boolean;
  wideState?: boolean;
  error?: string;
  same?: RowKey[];
  sameOpen?: boolean;
  withdrawn?: Withdrawn;
  agent?: AgentRun;
  port?: 'one' | 'two';
  points?: boolean;
  pointsOpen?: boolean;
  screen?: ScreenMode;
  multi?: MultiTargets;
  comments?: CommentPhase;
  confirm?: ConfirmKind;
  live?: boolean;
};

type ConfirmKind = 'merge' | 'discard';

type View = {
  selected?: RowKey;
  status: SketchStatus;
  errored: RowKey[];
  failures: Partial<Record<RowKey, string>>;
  comparing: boolean;
  listError?: string;
  retry: string;
  added?: Added;
  wideState?: boolean;
  error?: string;
  withdrawn?: Withdrawn;
  take: string;
  takeLocked: string;
  points: string;
  confirm?: string;
  comments?: Record<string, string>;
  commentTargets?: boolean;
};

const DRAWN: RowKey = 'b';

const LIST_WIDTH = 1100;
const LIST_HEIGHT = 720;
const LIST_VIEWPORT = { width: LIST_WIDTH, height: LIST_HEIGHT };

const LIST_ERROR = 'missing build: pages/sketches';
const FAILED_REASONS = { b: 'default: boom is not defined' };
const failedMark = (reason: string) =>
  html`<span class="text-ui-xs text-et-theme-ink" data-et-semantic-color="error" role="alert" data-sk-compare-failed
    >Vergleich fehlgeschlagen: ${reason}</span
  >`;

const rowFailedMark = (reason: string) =>
  html`<span
    class="line-clamp-3 text-ui-xs text-et-theme-ink wrap-anywhere"
    data-et-semantic-color="error"
    role="alert"
    title="${SKETCHES_LABELS.rowFailed(reason)}"
    data-sk-row-failed
    >${SKETCHES_LABELS.rowFailed(reason)}</span
  >`;

const PORT_MERGED = {
  one: ['components/quantity-stepper'],
  two: ['components/quantity-stepper', 'components/shop-bar'],
};

const COUNT_STATES = ['count', 'count-hover', 'count-active', 'count-focus-visible'];
const MERGE_ERROR =
  'components/quantity-stepper hat sich seit dem Sketch geändert. Lass deinen Agent den Sketch rebasen.';

const errorText = (reason: string) =>
  html`<p class="m-0 text-ui-xs text-et-theme-ink" data-et-semantic-color="error" role="alert" data-sk-merge-error>
    ${reason}
  </p>`;

const foldedLabel = (count: number) =>
  count === 1 ? '1 unveränderter Zustand eingeklappt' : `${count} unveränderte Zustände eingeklappt`;

const pendingLabel = (count: number) => (count === 1 ? 'vergleicht 1 Zustand …' : `vergleicht ${count} Zustände …`);

const pendingFailedLabel = (count: number) =>
  count === 1 ? 'Vergleich von 1 Zustand fehlgeschlagen' : `Vergleich von ${count} Zuständen fehlgeschlagen`;

type Added = { state: string; in: RowKey[] };

const ADDED: Added = { state: 'add-disabled', in: ['a'] };

const withAdded = (part: SketchPart): SketchPart => ({
  ...part,
  states: [...part.states, ADDED.state],
  rows: part.rows.map((row) => (ADDED.in.includes(row.key) ? { ...row, changed: [...row.changed, ADDED.state] } : row)),
});

const WIDE: Added = { state: 'count-focus-tooltip', in: ['b'] };

const MEASURED_WIDTH = 197;

const withWideState = (part: SketchPart): SketchPart => ({
  ...part,
  states: [...part.states, WIDE.state],
  render: (state) => part.render(state === WIDE.state ? 'count-focus-visible' : state),
  rows: part.rows.map((row) => (WIDE.in.includes(row.key) ? { ...row, changed: [...row.changed, WIDE.state] } : row)),
});

const measuredCell = (part: SketchPart, row: Row, state: string, pending: boolean) =>
  cell(
    { ...part, width: MEASURED_WIDTH },
    row,
    state,
    `--sk-frame: calc(var(--sk-scale) * ${MEASURED_WIDTH}px)`,
    pending,
  );

const missingCell = (row: Row, state: string) =>
  html`<div class="row-span-2 grid min-w-0 grid-rows-subgrid gap-y-space-1" data-sk-state="${state}" data-sk-missing>
    <span class="row-start-1 flex min-w-0 items-center in-data-sk-labels-hidden:hidden" data-sk-label
      ><span class="min-w-0 font-code text-(length:--sk-label) leading-[1.35] text-et-surface-muted wrap-anywhere"
        >${state}</span
      ></span
    >
    <div
      class="row-start-2 box-border flex w-(--sk-frame) items-center justify-center rounded-control-sm border border-dashed border-(--et-surface-border-solid) p-space-2 text-center text-ui-xs text-et-surface-muted"
    >
      ${row.key === 'current' ? SKETCHES_LABELS.newInSketch : SKETCHES_LABELS.missingInVariant}
    </div>
  </div>`;

const cellTargetOf = (row: Row, state: string, view: View) =>
  view.commentTargets && row.key !== 'current'
    ? html`<div class="absolute inset-0 z-2">${commentLayer(`${row.key} ${state}`, 'comments-draft')}</div>`
    : '';

const stageOf = (part: SketchPart, row: Row, view: View) =>
  view.added || view.wideState
    ? html`<div
        class="grid min-w-0 grid-cols-[repeat(var(--sk-cols),minmax(var(--sk-frame),max-content))] gap-x-6 **:data-sk-label:w-0 **:data-sk-label:min-w-full gap-y-space-3"
        data-sk-stage
      >
        ${part.states
          .map((state) =>
            (state === view.added?.state && !view.added.in.includes(row.key)) ||
            (view.wideState && state === WIDE.state && !WIDE.in.includes(row.key))
              ? missingCell(row, state)
              : state === WIDE.state
                ? measuredCell(part, row, state, view.comparing)
                : cell(part, row, state, '', view.comparing, cellTargetOf(row, state, view)),
          )
          .join('')}
      </div>`
    : wrapStage(part, row, view.comparing, (state) => cellTargetOf(row, state, view));

const multiSketchOf = (multi: MultiTargets, status: SketchStatus) => ({
  open: true,
  items: [
    {
      part: 'badge',
      name: 'kopf-tags',
      status: status === 'waiting' ? ('ready' as const) : ('in-progress' as const),
      selected: true,
      nested: targetsOf(multi).map((target) => ({ name: target, leaf: true })),
    },
  ],
});

const treeOf = (key: string, multi: MultiTargets | undefined, status: SketchStatus) =>
  partTree.render({
    ...(multi ? { sketches: multiSketchOf(multi, status) } : {}),
    layers: [
      {
        title: 'Components',
        open: true,
        parts: [...new Set(Object.values(PARTS).map((entry) => entry.key.replace('components/', '')))].map((name) => ({
          name,
          leaf: true,
          ...(!multi && `components/${name}` === key ? { selected: true } : {}),
        })),
      },
      {
        title: 'Pages',
        open: true,
        parts: [
          { name: 'shop', leaf: true },
          ...(key === SCREEN_KEY ? [{ name: SCREEN_KEY.replace('pages/', ''), leaf: true, selected: true }] : []),
        ],
      },
    ],
  });

const pagePin = commentPinMark(pinProps(PAGE_PIN));

const ROUNDS: Record<PartKind | 'screen', string> = {
  wide: 'Runde 1 · Suche und Korb',
  narrow: 'Runde 1 · Korb-Knopf und Anzahl',
  neighbours: 'Runde 3 · Nachbarschaft einer Änderung',
  edit: BUILD_READY_LABELS.groups['direct-edit'],
  many: 'Runde 1 · Viele Zustände',
  phone: 'Runde 1 · Schmale Seite',
  screen: 'Runde 2 · Port nach dem Merge',
};

const controlsOf = async () => ({
  chip: await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' }),
});

const drawingMark = html`<span class="flex items-center gap-space-1 text-ui-sm text-et-surface-muted"
  ><span class="size-1.5 animate-pulse rounded-full bg-(--et-theme-color-primary-solid)"></span
  >${SKETCHES_LABELS.drawingMark}</span
>`;

const pointsChip = async (open: boolean) => {
  const drawn = await button.render({
    label: openLabel(SKETCH_POINTS.length),
    icon: `<span class="contents" data-et-semantic-color="warning">${icon('warning', { size: 14, cls: 'text-et-theme' })}</span>`,
    variant: 'outline',
    size: 'sm',
    pressed: open,
  });
  return {
    body: withAction(drawn.body, open ? 'sketch-only-points' : 'sketch-only-points-open'),
    styles: drawn.styles,
  };
};

const pointsPopover = async (part: string) => {
  const lines = SKETCH_POINTS.map(
    ({ icon: name, text, detail }) =>
      html`<li class="flex items-center gap-space-2 px-space-3 py-space-1">
        ${icon(name, { size: 14, cls: 'flex-none text-(--et-surface-color-muted-solid)' })}<span
          class="min-w-0 flex-1 truncate text-(--et-surface-color-solid)"
          >${text}</span
        ><span class="font-code text-ui-xs text-(--et-surface-color-muted-solid)">${detail}</span>
      </li>`,
  ).join('');
  const dialog = await anchoredDialog.render({
    label: 'Offene Punkte',
    modal: false,
    anchor: '[data-sk-points]',
    content: html`<div class="w-96 text-ui-sm">
      <header
        class="flex items-baseline gap-space-2 border-b border-(--et-surface-border-solid) px-space-3 pt-space-3 pb-space-2"
      >
        <span class="font-ui-strong text-(--et-surface-color-solid)">Offene Punkte</span>
        <span class="ms-auto font-code text-ui-xs text-(--et-surface-color-muted-solid)">${part}</span>
      </header>
      <ul class="m-0 list-none p-0 py-space-1">
        ${lines}
      </ul>
    </div>`,
  });
  return {
    body: html`<div class="absolute top-full left-0 z-10 mt-2.5" style="transform: translate3d(0, 0, 0)">
      ${dialog.body}
    </div>`,
    styles: dialog.styles,
  };
};

const confirmDialog = async (kind: ConfirmKind, part: string, variant: string) => {
  const merge = kind === 'merge';
  const cancel = await button.render({
    label: SKETCHES_LABELS.confirm.cancel,
    variant: 'outline',
    color: 'surface',
    size: 'xs',
    interaction: 'focus-visible',
  });
  const confirm = await button.render({
    label: merge ? SKETCHES_LABELS.mergeConfirm.confirm : SKETCHES_LABELS.discard,
    variant: 'filled',
    size: 'xs',
    ...(merge ? {} : { color: 'danger' as const }),
  });
  const content = html`<div
    class="box-border flex w-80 flex-col gap-space-3 p-space-3 text-ui-sm"
    data-sk-confirm-dialog
  >
    <div class="flex flex-col gap-space-1">
      <span class="font-ui-strong wrap-anywhere text-et-surface"
        >${merge ? `${variant} in ${part} übernehmen?` : `Skizze ${part} verwerfen?`}</span
      >
      <span class="text-et-surface-muted"
        >${merge ? SKETCHES_LABELS.mergeConfirm.note : SKETCHES_LABELS.discardConfirm.note}</span
      >
    </div>
    <div class="flex justify-end gap-space-2">${cancel.body}${confirm.body}</div>
  </div>`;
  const dialog = merge
    ? await anchoredDialog.render({
        label: SKETCHES_LABELS.mergeConfirm.label,
        placement: 'bottom-start',
        anchor: '[data-sk-take] > :first-child',
        content,
      })
    : await anchoredDialog.render({
        label: SKETCHES_LABELS.discardConfirm.label,
        placement: 'top-end',
        anchor: '[data-sk-discard]',
        content,
      });
  return {
    body: html`<div
      class="absolute ${merge ? 'top-full left-0 mt-2.5' : 'right-1/2 bottom-full mb-2.5'} z-10"
      style="transform: translate3d(${merge ? '0' : '2.6rem'}, 0, 0)"
    >
      ${dialog.body}
    </div>`,
    styles: dialog.styles + cancel.styles + confirm.styles,
  };
};

const pinFor = (row: Row) =>
  row.key === 'a'
    ? html`<span class="absolute top-space-1 right-space-1 z-1 flex in-data-sk-head-hidden:hidden" data-sk-pin
        >${pagePin}</span
      >`
    : '';

const headOf = (row: Row, view: View) => {
  const drawn = view.status === 'drawing' && row.key === DRAWN;
  const open = view.status === 'waiting';
  const offered =
    (open || view.status === 'drawing') && view.errored.length === 0 && !isSame(row)
      ? open
        ? view.take
        : view.takeLocked
      : '';
  const take =
    offered && view.confirm && row.key === view.selected
      ? html`<span class="relative flex" data-sk-take>${offered}${view.confirm}</span>`
      : offered;
  const withPoints =
    view.points && row.key === view.selected
      ? html`<span class="relative flex flex-wrap items-center gap-space-2">${take}${view.points}</span>`
      : take;
  const mergeFailed = view.error && row.key === view.selected ? errorText(view.error) : '';
  const action = drawn ? drawingMark : withPoints + mergeFailed;
  const failed = view.listError ? failedMark(view.listError) : comparingMark;
  const renderFailure = view.failures[row.key];
  const mark =
    (renderFailure ? rowFailedMark(renderFailure) : '') + (view.comparing && row.key !== 'current' ? failed : '');
  if (isWithdrawn(row, view.withdrawn)) return rowHead(row, withdrawnMark, mark);
  return rowHead(row, action, mark) + (drawn || view.comments ? '' : pinFor(row));
};

const tagNoteOf = (row: Row) =>
  row.note
    ? html`<p
        class="m-0 mt-space-1 hidden text-ui-xs text-et-surface-muted wrap-anywhere in-data-sk-head-hidden:line-clamp-2"
        title="${row.note}"
        data-sk-tag-note
      >
        ${row.note}
      </p>`
    : '';

const gridRow = (part: SketchPart, row: Row, view: View) => {
  return html`<section
    class="sk-row grid grid-cols-[minmax(0,1fr)] gap-space-5 rounded-control-md p-space-3 in-data-sk-head-hidden:gap-space-2"
    data-sk-row="${row.key}"
    ${row.key === view.selected ? ' data-selected' : ''}
  >
    <div class="min-w-0" data-sk-head-row>
      <span
        class="hidden w-fit items-center rounded-full px-space-2 py-0.5 text-ui-xs font-ui-medium text-et-surface shadow-[0_0_0_1px_var(--et-surface-border-solid)] in-data-sk-head-hidden:inline-flex"
        data-sk-head-tag
        >${row.label ?? (row.key === 'current' ? SKETCHES_LABELS.current : row.key)}</span
      >
      ${tagNoteOf(row)}
      <div class="in-data-sk-head-hidden:hidden" data-sk-head-full>${headOf(row, view)}</div>
    </div>
    <div class="relative min-w-0 ${isWithdrawn(row, view.withdrawn) ? 'opacity-60' : ''}">
      ${stageOf(part, row, view)}${view.comments?.[row.key] ?? ''}
    </div>
  </section>`;
};

const sameToggle = (rows: Row[], open: boolean, body = '') =>
  disclosure({ label: sameLabel(rows), body, open, size: 'xs', action: 'emit:sameToggle' });

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

const gutter = (states: string[], top: number, block: number, offset: number) =>
  states
    .map(
      (state, index) =>
        html`<span
          class="flex items-center self-stretch pr-space-3 font-code text-(length:--sk-note) leading-[1.35] text-et-surface in-data-sk-head-hidden:text-transparent"
          data-sk-gutter
          data-sk-block="${block}"
          style="grid-column: ${offset + 1}; grid-row: ${top + 1 + index * 2} / span 2${block > 0 ? '; padding-left: 24px' : ''}"
          >${state}</span
        >`,
    )
    .join('');

const rowLabelOf = (row: Row) => row.label ?? (row.key === 'current' ? SKETCHES_LABELS.current : row.key);

const shortLabelOf = (label: string) => {
  const [, word, number = ''] = /^(\S+)(?:\s+(\d+))?$/.exec(label.trim()) ?? [];

  return word ? `${word.charAt(0)}${number}` : label;
};

const column = (part: SketchPart, states: string[], row: Row, at: number, top: number, view: View, block = 0) => {
  const head = html`<section
    class="sk-row relative w-0 min-w-full rounded-control-md p-space-2"
    data-sk-row="${row.key}"
    style="grid-column: ${at}; grid-row: ${top}"
    ${row.key === view.selected ? ' data-selected' : ''}
  >
    <span
      class="${block > 0 ? 'inline-flex max-w-full truncate px-1' : 'hidden in-data-sk-head-hidden:inline-flex max-w-full truncate px-space-2'} items-center rounded-full py-0.5 text-ui-xs font-ui-medium text-et-surface shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
      data-sk-head-tag
      >${block > 0 ? shortLabelOf(rowLabelOf(row)) : rowLabelOf(row)}</span
    >
    ${block > 0 ? '' : tagNoteOf(row) + html`<div class="in-data-sk-head-hidden:hidden" data-sk-head-full>${headOf(row, view)}</div>`}
  </section>`;
  const cells = states
    .map((state, index) =>
      cell(part, row, state, `grid-column: ${at}; grid-row: ${top + 1 + index * 2} / span 2`, view.comparing),
    )
    .join('');
  return head + cells;
};

const matrix = (part: SketchPart, shown: Row[], same: Row[], view: View, open: boolean) => {
  const top = same.length > 0 && open ? 2 : 1;
  const all = open ? [...shown, ...same] : shown;
  const stride = all.length + 1;
  const sizes = blockSizesOf(part, all.length, LIST_VIEWPORT);
  const blocks = sizes.map((size, index) => ({
    states: part.states.slice(
      sizes.slice(0, index).reduce((sum, count) => sum + count, 0),
      sizes.slice(0, index + 1).reduce((sum, count) => sum + count, 0),
    ),
    offset: index * stride,
  }));
  const tallest = Math.max(0, ...sizes);
  const after = blocks.length * stride + 1;
  const group =
    same.length === 0
      ? ''
      : open
        ? blocks
            .map(
              ({ offset }) =>
                html`<div
                  class="sk-same self-end rounded-control-md"
                  data-sk-same
                  data-open
                  style="grid-column: ${offset + shown.length + 2} / span ${same.length}; grid-row: 1"
                >
                  ${sameToggle(same, true)}
                </div>`,
            )
            .join('')
        : html`<div
            class="sk-same w-36 rounded-control-md p-space-1"
            data-sk-same
            data-et-skip="WRAP"
            style="grid-column: ${after}; grid-row: 1 / span ${tallest * 2 + 1}"
          >
            ${sameToggle(same, false)}
          </div>`;
  const first = 'max-content repeat(var(--sk-cols), minmax(max(var(--sk-frame), 120px), max-content))';
  const later = 'max-content repeat(var(--sk-cols), minmax(var(--sk-frame), max-content))';
  return html`<div
    class="grid w-max gap-x-6 **:data-sk-label:w-0 **:data-sk-label:min-w-full gap-y-space-3"
    style="grid-template-columns: ${[first, ...Array.from({ length: blocks.length - 1 }, () => later)].join(' ')} auto"
    data-sk-matrix
  >
    ${blocks
      .map(
        ({ states, offset }, index) =>
          gutter(states, top, index, offset) +
          all.map((row, at) => column(part, states, row, offset + at + 2, top, view, index)).join(''),
      )
      .join('')}
    ${group}
  </div>`;
};

const screenHead = (row: Row, at: number, view: View) =>
  html`<section
    class="sk-row relative w-0 min-w-full rounded-control-md p-space-2"
    data-sk-row="${row.key}"
    style="grid-column: ${at}; grid-row: 1"
  >
    <span
      class="hidden in-data-sk-head-hidden:inline-flex max-w-full items-center truncate rounded-full px-space-2 py-0.5 text-ui-xs font-ui-medium text-et-surface shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
      data-sk-head-tag
      >${row.label ?? (row.key === 'current' ? SKETCHES_LABELS.current : row.key)}</span
    >
    ${tagNoteOf(row)}
    <div class="in-data-sk-head-hidden:hidden" data-sk-head-full>${headOf(row, view)}</div>
  </section>`;

const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;

const locator = (group: ChangeGroup) => {
  const crop = cropOf(group.box);
  return html`<span
    class="relative block aspect-16/10 w-[calc(var(--sk-note)*9)] rounded-control-sm bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
    data-cc-locator
  >
    <span class="absolute inset-y-0 left-0 w-[18%] shadow-[1px_0_0_var(--et-surface-border-solid)]"></span>
    <span
      class="absolute rounded-[2px] border-2 border-et-theme"
      style="left: ${percent(crop.x, SCREEN_WIDTH)}; top: ${percent(crop.y, SCREEN_HEIGHT)}; width: ${percent(crop.width, SCREEN_WIDTH)}; height: ${percent(crop.height, SCREEN_HEIGHT)}"
    ></span>
  </span>`;
};

const stackEdges = html`<div
    class="mx-8 h-5 rounded-b-control-md bg-et-surface-bg shadow-[0_0_0_2px_var(--et-surface-border-solid)]"
  ></div>
  <div
    class="mx-16 h-5 rounded-b-control-md bg-et-surface-bg shadow-[0_0_0_2px_var(--et-surface-border-solid)]"
  ></div>`;

const buttonsOf = async () => {
  const toggleOf = async (label: string) =>
    withAction(
      ((await button.render({ label, variant: 'transparent', size: 'sm' })) as { body: string }).body,
      'emit:screenToggle',
    );
  return {
    wholeButton: await toggleOf(SKETCHES_LABELS.wholeScreen),
    cropButton: await toggleOf(SKETCHES_LABELS.cropScreen),
  };
};

type Buttons = Awaited<ReturnType<typeof buttonsOf>>;

const screenGutter = (group: ChangeGroup, line: number, whole: boolean, buttons: Buttons) => {
  const { wholeButton, cropButton } = buttons;
  const [first = ''] = group.states;
  const count = group.states.length;
  return html`<div
    class="flex w-[calc(var(--sk-note)*15)] flex-col justify-center gap-space-1 self-stretch pr-space-3 text-(length:--sk-note) leading-[1.35]"
    data-sk-gutter
    style="grid-column: 1; grid-row: ${line} / span 2"
  >
    <span class="font-code text-et-surface">${first}</span>
    ${count > 1 ? html`<span class="text-et-surface">${count} Zustände, gleicher Ausschnitt</span>` : ''}
    ${reasonLinesOf(group)
      .map(
        (line, index, lines) =>
          html`<span class="text-et-surface-muted" data-cc-reason
            >${line}${whole || index < lines.length - 1 ? '' : ` · ${zoomTextOf(cropOf(group.box))} vergrößert`}</span
          >`,
      )
      .join('')}
    <span class="mt-space-1 flex items-end gap-space-2">${locator(group)}${whole ? cropButton : wholeButton}</span>
  </div>`;
};

const shotsOf = async (group: ChangeGroup, whole: boolean) => {
  const state = group.states[0] ?? '';
  const [before, after] = await Promise.all([screenOf(state, false), screenOf(state, true)]);
  const marked = markedScreen(after.body, group.areas);
  if (whole) return { current: before.body, changed: marked };
  const crop = cropOf(group.box);
  const stack = group.states.length > 1 ? stackEdges : '';
  return { current: cropShot(before.body, crop), changed: cropShot(marked, crop) + stack };
};

const screenWorld = async (view: View, mode: ScreenMode) => {
  const buttons = await buttonsOf();
  const lines = await Promise.all(
    GROUPS.map(async (group, index) => {
      const line = 2 + index * 2;
      const state = group.states[0] ?? '';
      const whole = mode === 'whole' && index === 0;
      const { current, changed } = await shotsOf(group, whole);
      return (
        screenGutter(group, line, whole, buttons) +
        variantCell({
          state,
          width: SCREEN_WIDTH,
          shot: current,
          place: `grid-column: 2; grid-row: ${line} / span 2`,
        }) +
        variantCell({ state, width: SCREEN_WIDTH, shot: changed, place: `grid-column: 3; grid-row: ${line} / span 2` })
      );
    }),
  );
  return html`<div
    class="grid w-max grid-cols-[max-content_repeat(var(--sk-cols),var(--sk-frame))] gap-x-6 gap-y-space-3"
    data-sk-matrix
  >
    ${SCREEN_ROWS.map((row, index) => screenHead(row, index + 2, view)).join('')} ${lines.join('')}
  </div>`;
};

const zoomOf = (camera: Props['camera']): Zoom => (camera === 'fit' ? 'fit' : camera === '100' ? 1 : camera.zoom);
const startOf = (camera: Props['camera']) => (typeof camera === 'object' ? { x: camera.x, y: camera.y } : undefined);

type RowThread = PlacedThread & { row: string };

const VARIANT_THREADS: RowThread[] = [
  {
    row: 'a',
    at: 'left-[18%] top-[30%]',
    author: 'human',
    initials: 'H',
    when: 'vor 20 Min',
    part: 'Entwurf 1',
    state: 'add-hover',
    text: 'Die Pille wirkt hier zu eng, sie klebt am Zähler.',
    replies: 1,
  },
  {
    row: 'b',
    at: 'left-[52%] top-[55%]',
    author: 'Claude',
    initials: 'C',
    agent: 'claude',
    when: 'vor 4 Min',
    part: 'Entwurf 2',
    state: 'count-hover',
    text: 'Halbfett liest sich besser. Soll Entwurf 1 die Anzahl auch so bekommen?',
    replies: 2,
    unread: true,
  },
];

const COMMENT_DRAFT_AT = 'left-[30%] top-[40%]';

const variantComments = async (row: string, phase: CommentPhase | undefined) => {
  if (!phase) return { body: '', styles: '' };
  const own = VARIANT_THREADS.filter((thread) => thread.row === row);
  const pins = commentPins(own, phase === 'listed' ? own.findIndex((thread) => thread === VARIANT_THREADS[0]) : -1);
  const drafting = phase === 'draft' && row === 'b';
  const draft = drafting
    ? await commentDraftAt('top-[40%] left-[calc(30%+var(--space-6))] z-20', {
        text: 'Der Korb-Knopf braucht hier mehr Luft zur Anzahl.',
      })
    : undefined;
  return {
    body: pins + (drafting ? draftPin(COMMENT_DRAFT_AT) : '') + (draft?.body ?? ''),
    styles: draft?.styles ?? '',
  };
};

export default definePart<Props>({
  note: 'A <part>@edit sketch (a direct edit without an ADR) has the rows old and new and no Verwerfen button: the server refuses a discard (EDIT-DISCARD-REFUSED), it shows both rows named, Änderung behalten (new) and Zuletzt gemergter Stand (old), each with its own Übernehmen, never folded as unverändert. Eine Zeile je Variante, ganz oben Aktuell, bei einem neuen Teil ohne Aktuell und mit dem Badge neu. Links steht der Kopf: Variante, kurzer Modellname (Tooltip mit voller Kennung und Zeit), die Notiz und Übernehmen, das einen Bestätigungsdialog öffnet, erst Bestätigen übernimmt die Variante; Übernehmen steht nur da, wenn der Sketch auf die Wahl wartet. Das Badge oben folgt dem echten Zustand: zeichnet, solange eine Variante gezeichnet wird, Wartet auf deine Wahl, wenn alle stehen (die Wahl übernimmt die Variante sofort, einen Zustand Variante gewählt gibt es nicht); was noch fehlt, steht als erster offener Punkt, sonst Pausiert. Solange sketch ready nicht bestanden hat, steht Noch nicht bereit mit der ersten Zeile seiner letzten Ablehnung und danach der letzten Änderung daneben, ohne aufgezeichnete Ablehnung der Hinweis, sketch ready auszuführen; Übernehmen fehlt dann. Zeichnet eine Variante nicht, während der Sketch wartet oder noch nicht bereit ist, steht Render fehlgeschlagen in der Fehlerfarbe mit dem ersten Fehler daneben (Variante · Zustand: Fehler, weitere als (+N)), wie die Zeile von Noch nicht bereit; solange eine Variante einen Render-Fehler hat, fehlt Übernehmen in jeder Zeile. Setzt eine Variante ein neues data-et-skip, steht im Kopf dieser Variante je Marker eine Zeile mit Warnsymbol über Übernehmen: Neuer Skip <Klassen> in <Teil> - stellt eine Prüfung stumm; wer wählt, sieht so jede stumm geschaltete Prüfung. Die offenen Punkte des Sketches stehen im Kopf der Variante, deren Übernehmen zuletzt lief, als Chip neben Übernehmen, der die Liste Offene Punkte öffnet, auch für einen Teil, der noch keine gemergte Ansicht hat. Die Notiz wächst mit dem Zoom (15 px bei 100 %, nie unter 12 px bis Einpassen); weiter herausgezoomt skaliert der Kopf mit der Fläche, unter 9 px ist sein Text ausgeblendet. Rechts stehen die Zustände in einem Raster, jeder mit Namen (13 px mal Zoom, nie unter 12 px bis Einpassen, danach skaliert er mit der Fläche, unter 9 px ausgeblendet). Die Beispielzeilen tragen eigene Namen (Stand, Entwurf 1, Entwurf 2), damit sie sich von den echten Spalten ums Bild unterscheiden. Ein Teil breiter als ein Viertel der Ansicht zeigt eine Matrix: eine Spalte je Variante, Aktuell zuerst, die Zustände als Zeilen, der Zustandsname einmal je Zeile links; beim Verschieben bleibt diese Spalte am linken Rand stehen. Einpassen nimmt Aktuell und die erste Variante, in der Matrix deren zwei Spalten; weitere erreicht man durch Verschieben. Solange der Vergleich läuft, sind alle Rahmen neutral und der Kopf zeigt vergleicht …; Zustände, deren Vergleich noch aussteht, liegen schon eingeklappt hinter einer Zeile vergleicht N Zustände …, sichtbar sind nur die bisher als geändert bekannten Zustände, neue hängen sich hinten an. Die Antwort ändert nur den Text dieser Zeile zu N unveränderte Zustände eingeklappt, das Raster springt nicht. Danach sind unveränderte Zustände gedimmt und der erste geänderte markiert. Fügt eine Variante einen Zustand hinzu, den Aktuell nicht hat, zeigt Aktuell dort einen gestrichelten Rahmen neu in der Skizze, eine Variante ohne ihn fehlt in dieser Variante. Eine Zelle ist so breit wie der gemessene Zustand (etwa die Zoom-Pille mit offenem Tooltip) und schneidet nie ab. Beim Verschieben bleibt der Kopf jeder Zeile (Variante, Modell, Notiz, Übernehmen) wie die Zustandsspalte der Matrix am linken Rand stehen, deckend, ebenso der Text der eingeklappten Zeile. Varianten, die in jedem Zustand gleich Aktuell sind, liegen zusammen in einem zugeklappten Bereich unter den geänderten (in der Matrix eine schmale Spalte rechts), aufgeklappt wie vorher. Schlägt das Auflisten der Sketches fehl, steht im Kopf vor Verwerfen der Button Erneut laden, und jede Zeile, die noch vergleicht, zeigt statt vergleicht … in der Fehlerfarbe Vergleich fehlgeschlagen: <Grund des Servers>; die eingeklappte Zeile liest dann Vergleich von N Zuständen fehlgeschlagen. Schlägt Übernehmen oder eine andere Sketch-Aktion fehl, steht der Grund des Servers in schlichten Worten in der Fehlerfarbe im Kopf dieser Variante unter Übernehmen; der Seitenkopf bleibt ohne Fehler.',
  madeBy: ['claude-opus-5-5', 'gpt-6', 'claude-sonnet-5-5', 'design check'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/sketches/sketches.component.ts' },
  data: 'list',
  dataStates: { loading: 'comparing', error: 'list-error', empty: 'no-sketches' },
  controls: {
    canvas: { kind: 'field', part: 'components/canvas-viewport' },
    hold: { kind: 'button', part: 'components/hold-trigger' },
    toggle: { kind: 'button', input: ['pointer', 'keyboard'] },
    comment: { kind: 'button', part: 'components/button' },
    'comment-cancel': { kind: 'button', part: 'components/button' },
    'comment-send': { kind: 'button', part: 'components/button' },
    'comment-target': { kind: 'button', part: 'components/comment-target' },
  },
  states: {
    'page-sketch': { camera: 'fit' },
    'page-100': { camera: '100' },
    'zoomed-page': { camera: { zoom: 0.6, x: -853.2, y: 44 }, selected: 'a' },
    drawing: { camera: 'fit', status: 'drawing' },
    paused: { camera: 'fit', status: 'paused' },
    failed: { camera: 'fit', status: 'failed', errored: ['b'], failures: FAILED_REASONS },
    'new-part': { camera: 'fit', fresh: true },
    'narrow-part': { camera: 'fit', part: 'narrow' },
    'sticky-names': { camera: { zoom: 0.8, x: -1700, y: -260 } },
    comparing: { camera: 'fit', comparing: true },
    'comparing-narrow': { camera: 'fit', part: 'narrow', comparing: true },
    'no-sketches': { camera: 'fit', empty: true },
    'list-error': { camera: 'fit', part: 'narrow', comparing: true, listError: LIST_ERROR },
    'compare-pending': { camera: 'fit', part: 'narrow', comparing: true, known: [...COUNT_STATES] },
    'compare-answered': { camera: 'fit', part: 'narrow' },
    neighbourhood: { camera: 'fit', part: 'neighbours' },
    'added-state': { camera: 'fit', part: 'narrow', added: true },
    'narrow-wide-state': { camera: 'fit', part: 'narrow', wideState: true },
    'panned-zoomed': { camera: { zoom: 1.5, x: -500, y: 0 }, part: 'narrow' },
    'merge-error': { camera: 'fit', part: 'narrow', selected: 'b', error: MERGE_ERROR },
    'below-fit': { camera: { zoom: 0.25, x: 0, y: 0 } },
    'far-out': { camera: { zoom: 0.1, x: 0, y: 0 } },
    'narrow-below-fit': { camera: { zoom: 0.8, x: 0, y: 0 }, part: 'narrow' },
    'narrow-far-out': { camera: { zoom: 0.5, x: 0, y: 0 }, part: 'narrow' },
    unchanged: { camera: 'fit', part: 'narrow', same: ['b'] },
    'unchanged-open': { camera: 'fit', part: 'narrow', same: ['b'], sameOpen: true },
    'all-unchanged': { camera: 'fit', part: 'narrow', same: ['a', 'b'] },
    'unchanged-matrix': { camera: { zoom: 0.25, x: -4000, y: 0 }, same: ['b', 'c'] },
    'unchanged-matrix-open': { camera: { zoom: 0.2, x: -4000, y: 0 }, same: ['b', 'c'], sameOpen: true },
    'withdrawn-hidden': { camera: 'fit', part: 'narrow', withdrawn: 'hidden' },
    'withdrawn-shown': { camera: 'fit', part: 'narrow', withdrawn: 'shown' },
    'port-round': { camera: 'fit', part: 'narrow', port: 'two' },
    'agent-failed': { camera: 'fit', part: 'narrow', agent: 'failed', errored: ['b'], failures: FAILED_REASONS },
    'sketch-only-points': { camera: 'fit', part: 'narrow', fresh: true, selected: 'b', points: true },
    'sketch-only-points-open': {
      camera: 'fit',
      part: 'narrow',
      fresh: true,
      selected: 'b',
      points: true,
      pointsOpen: true,
    },
    'edit-sketch': { camera: 'fit', part: 'edit' },
    'change-crop': { camera: 'fit', part: 'narrow', screen: 'crop' },
    'change-crop-whole': { camera: 'fit', part: 'narrow', screen: 'whole' },
    'many-states-wrap': { camera: 'fit', part: 'many' },
    'farn-page': { camera: { zoom: 0.6, x: 0, y: 0 }, part: 'many' },
    'farn-page-narrow': { camera: 'fit', part: 'phone' },
    'multi-part': { camera: 'fit', part: 'narrow', multi: 'three' },
    'multi-part-many': { camera: 'fit', part: 'narrow', multi: 'many' },
    comments: { camera: 'fit', part: 'narrow', comments: 'listed' },
    'comments-mode': { camera: 'fit', part: 'narrow', comments: 'mode' },
    'comments-draft': { camera: 'fit', part: 'narrow', comments: 'draft' },
    'merge-confirm': { camera: 'fit', part: 'narrow', selected: 'b', confirm: 'merge' },
    'discard-confirm': { camera: 'fit', part: 'narrow', confirm: 'discard' },
    live: { camera: 'fit', part: 'narrow', live: true },
  },
  describe: {
    'page-sketch':
      'A sketch fitted to the view with Aktuell and the first variant; check each row head with variant, model, note and Übernehmen and the state grid beside it.',
    'page-100': 'The sketch at 100 %; check the 15px notes and 13px state names, and that no cell is cut off.',
    'zoomed-page':
      'The sketch zoomed to 60 % and panned with variant a selected; check that the row heads stay pinned at the left edge, opaque over the cells.',
    drawing:
      'A variant still drawing; check the zeichnet badge in the header, that Übernehmen is missing, and that the drawing variant shows its frames live like a finished one.',
    paused: 'A paused sketch; check the Pausiert badge in the header.',
    failed:
      'Variant b failed to render; check the Fehler badge in the toolbar, Render fehlgeschlagen: default: and the error in the head of row b in the error colour, and no Übernehmen in any row.',
    'new-part': 'A sketch of a new part; check that there is no Aktuell row and the neu badge shows.',
    'narrow-part':
      'A narrow part as one row per variant; check the state grid with its names and the cell widths that follow each measured state.',
    'sticky-names':
      'A wide part as a matrix panned at 80 %; check that the state names scroll with the cells, with no opaque column behind them.',
    comparing: 'The comparison still running; check vergleicht … in the header and that every frame stays neutral.',
    'comparing-narrow':
      'A narrow part while comparing; check the neutral frames and the folded vergleicht N Zustände … line.',
    'no-sketches':
      'A product without open sketches; check the empty side panel and the centred check icon with the empty message on the page.',
    'list-error':
      'The sketch listing failed while comparing; check Erneut laden before Verwerfen and Vergleich fehlgeschlagen with the reason in the error colour.',
    'compare-pending':
      'Some states known as changed while the rest still compare; check that only those show and the rest sit folded behind one line.',
    neighbourhood:
      'Each variant changes one interaction of a control; check that the whole row of that control shows, the changed cell bright and its neighbours dimmed, and that the other controls stay folded.',
    'compare-answered': 'The comparison done; check that unchanged states are dimmed and the grid did not jump.',
    'added-state':
      'A variant adds a state Aktuell lacks; check the dashed neu in der Skizze frame in Aktuell and fehlt in dieser Variante where it is missing.',
    'narrow-wide-state':
      'A narrow part with one wide state; check that this cell takes its measured width and nothing in the row is cut off.',
    'panned-zoomed':
      'A narrow part at 150 % panned; check that the row heads stay pinned at the left and the notes keep their size.',
    'merge-error':
      'Übernehmen of b failed; check the server reason in the error colour under Übernehmen of b and no error in the page header.',
    'below-fit':
      'The sketch at 25 %, below fit; check that the heads scale with the canvas and the text hides below 9px.',
    'far-out': 'The sketch at 10 %; check that only frames show and every head and state name text is hidden.',
    'narrow-below-fit':
      'A narrow part zoomed out below fit; check that notes and names stay at 12px or more until fit and do not overlap.',
    'narrow-far-out': 'A narrow part zoomed far out; check that the heads scale with the canvas and no text overlaps.',
    unchanged:
      'Variant b equal to Aktuell in every state; check that it sits in the folded area under the changed rows.',
    'unchanged-open': 'The unchanged area opened; check that b shows below the changed rows as before.',
    'all-unchanged':
      'Every variant equal to Aktuell; check that both sit in the folded area and only Aktuell stays open.',
    'unchanged-matrix': 'A matrix with variants b and c unchanged; check the narrow folded column at the right.',
    'unchanged-matrix-open': 'The folded matrix column opened; check that b and c show as full columns again.',
    'withdrawn-hidden': 'A variant the agent withdrew, hidden; check the switch to show it and that its row is gone.',
    'withdrawn-shown':
      'The withdrawn variant shown; check its faded row and Vom Agent zurückgezogen with the reason in its head.',
    'port-round':
      'A port run after a merge; check the note above the rows names every merged part, and that the toolbar shows only the zeichnet badge.',
    'agent-failed':
      'A failed agent run; check the failure in the error colour in the head of row b, and no model, round or failure text in the toolbar.',
    'sketch-only-points':
      'A new part with open points after Übernehmen on b; check the open-points chip beside Übernehmen in the head of b.',
    'sketch-only-points-open':
      'The open-points list opened; check the Offene Punkte popover under the chip, not cut off by the canvas.',
    'edit-sketch':
      'A direct edit; check the rows Änderung behalten and Zuletzt gemergter Stand, each with Übernehmen, and no Verwerfen.',
    'change-crop':
      'A round showing a cropped screen; check the Runde 2 · Port nach dem Merge picker and the cropped cells.',
    'change-crop-whole':
      'The same round showing the whole screen; check that the full frame fits each cell without cutting it.',
    'farn-page':
      'The whole Farn sample shop page in the first state frame; check the bar, the featured plant and the four cards fit without clipping.',
    'farn-page-narrow':
      'The Farn shop page in a 390 px wide frame; check that the logo sits left, the account and basket right, and the hero and cards stack without clipping.',
    'many-states-wrap':
      'A part with 30 wide states in a 1100 px list; check that Einpassen stops at frames 160 px wide, shows the states in one block in state order with the full variant heads and Übernehmen, and the list scrolls to the rest.',
    'multi-part': 'A sketch over three parts; check that each part shows its own block of state rows with its name.',
    'multi-part-many':
      'A sketch over many parts; check that the part blocks stay readable and the list stays inside the canvas.',
    comments: 'The comment pins of the sketch; check their numbers and where they sit on the cells.',
    'comments-mode': 'Comment mode on; check the pressed Kommentar toggle and the crosshair over the cells.',
    'comments-draft':
      'A comment draft on a cell; check that the draft card sits beside its pin and does not cover a numbered pin.',
    'merge-confirm':
      'Übernehmen of b asks first; check the confirmation dialog anchored to the button with Bestätigen.',
    'discard-confirm':
      'Verwerfen asks first; check the confirmation dialog above the Verwerfen icon in the floating toolbar.',
    live: 'A frame made live by a double click; check the Live · Esc badge at the top right of the canvas.',
  },
  groups: [
    {
      label: 'Übersicht',
      states: [
        'page-sketch',
        'page-100',
        'new-part',
        'edit-sketch',
        'narrow-part',
        'narrow-wide-state',
        'sticky-names',
        'many-states-wrap',
        'farn-page',
        'farn-page-narrow',
        'multi-part',
        'multi-part-many',
      ],
    },
    {
      label: 'Status',
      states: ['drawing', 'paused', 'sketch-only-points', 'sketch-only-points-open', 'live'],
    },
    {
      label: 'Agent und Runden',
      states: ['port-round', 'change-crop', 'change-crop-whole'],
    },
    {
      label: 'Vergleich',
      states: [
        'comparing',
        'comparing-narrow',
        'compare-pending',
        'compare-answered',
        'neighbourhood',
        'added-state',
        'unchanged',
        'unchanged-open',
        'all-unchanged',
        'unchanged-matrix',
        'unchanged-matrix-open',
        'withdrawn-hidden',
        'withdrawn-shown',
      ],
    },
    {
      label: 'Zoom',
      states: ['zoomed-page', 'panned-zoomed', 'below-fit', 'far-out', 'narrow-below-fit', 'narrow-far-out'],
    },
    { label: 'Kommentare', states: ['comments', 'comments-mode', 'comments-draft'] },
    { label: 'Bestätigen', states: ['merge-confirm', 'discard-confirm'] },
    { label: 'Leer', states: ['no-sketches'] },
    { label: 'Fehler', states: ['failed', 'agent-failed', 'merge-error', 'list-error'] },
  ],
  render: async ({
    camera,
    selected,
    status = 'waiting',
    failures = {},
    errored = [],
    fresh = false,
    autoMerge = false,
    part: kind = 'wide',
    comparing = false,
    listError,
    empty = false,
    known = [],
    added = false,
    wideState = false,
    error,
    same: sameKeys = [],
    sameOpen = false,
    withdrawn,
    agent,
    port,
    points = false,
    pointsOpen = false,
    screen,
    multi,
    comments,
    confirm,
    live = false,
  }) => {
    if (empty) {
      const menu = await studioMenu({ open: false });
      const shell = await shellMain.render({
        studio: menu.body,
        section: 'Sketches',
        product: 'studio',
        side: html`<p class="px-space-3 py-space-2 text-et-surface-muted text-ui-sm">${SKETCHES_LABELS.none}</p>`,
        content: html`<div
          class="h-full flex flex-col items-center justify-center gap-space-1 text-center ps-(--st-shell-inset-left)"
        >
          ${icon('check', { size: 14, cls: 'size-5 mb-space-2 text-et-theme-ink' })}
          <p class="m-0 text-et-surface text-(length:--text-sm)">${SKETCHES_LABELS.emptyTitle}</p>
          <p class="m-0 text-et-surface-muted text-(length:--text-xs)">${SKETCHES_LABELS.emptyText}</p>
        </div>`,
      });
      return drawing({ body: shell.body, setup: [menu.setup], styles: shell.styles + menu.styles });
    }
    const { chip } = await controlsOf();
    const reload = await button.render({
      label: SKETCHES_LABELS.reload,
      variant: 'outline',
      color: 'surface',
      size: 'sm',
    });
    const retry = listError ? withAction(reload.body, 'emit:retry') : '';
    const take = await takeButton();
    const takeLocked = await takeButton(true);
    const run = agent ? AGENT_RUNS[agent] : undefined;
    const base = withSame(PARTS[kind], comparing ? [] : sameKeys);
    const full = added ? withAdded(base) : wideState ? withWideState(base) : base;
    const rowStyles = await prepareShots(full);
    const pending = comparing ? full.states.filter((state) => !known.includes(state)) : [];
    const hidden = comparing ? pending : unchangedStates(full);
    const part = hidden.length > 0 ? { ...full, states: full.states.filter((state) => !hidden.includes(state)) } : full;
    const side = await treeOf(screen ? SCREEN_KEY : part.key, multi, status);
    const all = rowsOf(part, fresh);
    const rows = visibleRows(all, withdrawn);
    const picked = all.find((row) => row.key === selected);
    const dialog = confirm
      ? await confirmDialog(confirm, full.key, picked?.label ?? `Variante ${selected ?? ''}`)
      : undefined;
    const hiddenCount = withdrawnCount(all, withdrawn);
    const same = comparing ? [] : rows.filter(isSame);
    const shown = rows.filter((row) => !same.includes(row));
    const pointsButton = points ? await pointsChip(pointsOpen) : undefined;
    const popover = points && pointsOpen ? await pointsPopover(full.key) : undefined;
    const layers = await Promise.all(
      rows.map(async (row) => [row.key, await variantComments(row.key, comments)] as const),
    );
    const list = comments ? commentList(VARIANT_THREADS, comments === 'listed' ? 0 : -1) : undefined;
    const view: View = {
      ...(comments ? { comments: Object.fromEntries(layers.map(([key, layer]) => [key, layer.body])) } : {}),
      ...(comments && comments !== 'listed' ? { commentTargets: true } : {}),
      selected,
      status,
      errored,
      failures,
      comparing,
      listError,
      retry,
      added: added ? ADDED : undefined,
      wideState,
      error,
      withdrawn,
      take: takeAction(take.body),
      takeLocked: html`<span class="flex">${takeLocked.body}</span>`,
      confirm: confirm === 'merge' ? dialog?.body : undefined,
      points: pointsButton
        ? html`<span class="flex" data-sk-points>${pointsButton.body}</span>${popover?.body ?? ''}`
        : '',
    };
    const transposed = isTransposed(part, LIST_WIDTH);
    const columns = transposed && sameOpen ? rows.length : shown.length;
    const world = screen
      ? await screenWorld(view, screen)
      : transposed
        ? matrix(part, shown, same, view, sameOpen)
        : shown.map((row) => gridRow(part, row, view)).join('') + sameRows(part, same, view, sameOpen);
    const folded = screen ? UNCHANGED_COUNT : hidden.length;
    const head = await sketchHead({
      round: ROUNDS[screen ? 'screen' : kind],
      status: (run && !run.failed) || port ? 'drawing' : status,
      autoMerge,
      discardable: kind !== 'edit' || !!screen,
      retry: !!listError,
      comment: comments
        ? { on: comments !== 'listed', action: comments === 'listed' ? 'comments-mode' : 'comments' }
        : undefined,
      discardDialog: confirm === 'discard' ? dialog?.body : undefined,
      withdrawn: hiddenCount > 0 ? { count: hiddenCount, shown: withdrawn === 'shown' } : undefined,
      class: 'absolute bottom-space-3 left-1/2 z-3 max-w-[calc(100%-40rem)] -translate-x-1/2',
    });
    const shownRoundNote = port ? SKETCHES_LABELS.mergePort(PORT_MERGED[port]) : '';
    const toggle = await disclosurePart.render({ label: '', body: '', open: false });
    const parts = { body: '', styles: '' };
    const content = html`<div
      class="relative isolate box-border flex h-full flex-col gap-space-4 overflow-hidden p-space-5 pl-[calc(var(--st-shell-inset-left,0px)+var(--space-5))]"
      data-sketches-page
    >
      ${parts.body}
      <div
        class="relative -m-space-5 -ml-[calc(var(--st-shell-inset-left)+var(--space-5))] box-border flex min-h-0 flex-1 flex-col overflow-clip pr-space-5 pl-[calc(var(--st-shell-inset-left)+var(--space-5))]"
      >
        ${
          shownRoundNote
            ? html`<p
                class="m-0 shrink-0 truncate pt-space-3 text-ui-sm text-et-surface-muted"
                title="${shownRoundNote}"
                data-sk-round-note
              >
                ${shownRoundNote}
              </p>`
            : ''
        }
        ${canvasViewport({
          class: 'min-h-0 w-full flex-1',
          attrs: 'data-sk-rows',
          body: html`<div
            class="flex flex-col gap-space-2 pb-16 ${transposed ? 'w-max' : ''}"
            data-sk-rows-world
            data-w="${screen ? SCREEN_WIDTH : part.width}"
            data-cols="${screen ? SCREEN_ROWS.length : transposed ? columns : wrapColumns(part)}"
            data-blocks="${screen || !transposed ? 1 : blockSizesOf(part, columns, LIST_VIEWPORT).length}"
          >
            ${world}
            ${
              folded > 0
                ? html`<section
                    class="sk-same rounded-control-md p-space-2"
                    data-sk-folded
                    ${pending.length > 0 ? 'data-sk-pending' : ''}
                  >
                    ${html`<span class="flex items-center gap-space-3" style="transform: translateX(var(--sk-pan-x, 0px))"><span class="text-ui-sm text-et-surface-muted">${pending.length > 0 ? (listError ? pendingFailedLabel(folded) : pendingLabel(folded)) : foldedLabel(folded)}</span>${disclosure({ label: SKETCHES_LABELS.showAllStates, body: '', open: false, size: 'xs', hug: true, action: 'emit:statesToggle' })}</span>`}
                  </section>`
                : ''
            }
          </div>`,
        })}
      </div>
      ${head.body} ${chip.body}
      ${live ? html`<div class="pointer-events-none absolute top-space-3 right-space-3 z-3 flex text-ui-sm">${liveBadge}</div>` : ''}
    </div>`;

    const menu = await studioMenu({ open: false });

    const shell = await shellMain.render({
      studio: menu.body,
      section: 'Sketches',
      product: 'studio',
      side: list ? withCommentList(side.body, list.body) : side.body,
      content,
    });

    return drawing({
      body: shell.body,
      setup: [
        menu.setup,
        (root: HTMLElement) => {
          mountFit(root, zoomOf(camera), startOf(camera));
        },
        head.setup,
      ],
      styles:
        shell.styles +
        menu.styles +
        side.styles +
        reload.styles +
        head.styles +
        (toggle as { styles: string }).styles +
        take.styles +
        (pointsButton?.styles ?? '') +
        (popover?.styles ?? '') +
        (dialog?.styles ?? '') +
        parts.styles +
        (list?.styles ?? '') +
        layers.map(([, layer]) => layer.styles).join('') +
        rowStyles +
        variantCellStyles +
        canvasViewportStyles +
        kit +
        styles,
    });
  },
});
