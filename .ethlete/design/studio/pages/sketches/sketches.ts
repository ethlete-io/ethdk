import { definePart, drawing, html, withAction } from '@design-system';
import button from '@system/components/button';
import { icon } from '@system/foundations/icons';
import select from '@system/components/select';
import switchPart from '@system/components/switch';
import badge from '@system/components/badge';
import { commentPinMark } from '@system/components/comment-pin';
import { holdTrigger } from '@system/components/hold-trigger';
import { type SketchStatus, sketchStatusBadge } from '@system/components/sketch-status-badge';
import { variantCell, variantCellStyles } from '@system/elements/variant-cell';
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
  AGENT_RUNS,
  type AgentProgress,
  type AgentRun,
  HOLD,
  IDLE,
  drawingPlaceholder,
  modelName,
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
  comparingMark,
  isSame,
  isTransposed,
  mountFit,
  prepareShots,
  rowHead,
  rowsOf,
  sameLabel,
  takeAction,
  takeButton,
  wrapColumns,
  withSame,
  wrapStage,
} from './shared/sketch-rows';
import { SKETCH_POINTS, openLabel } from './shared/open-points';
import { type Withdrawn, isWithdrawn, visibleRows, withdrawnCount, withdrawnMark } from './shared/withdrawn';
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
  reasonOf,
  screenOf,
  zoomTextOf,
} from './shared/change-crop';

type MergePort = 'one' | 'two';

type ScreenMode = 'crop' | 'whole';

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
  agent?: AgentRun;
  fold?: number;
  question?: string;
  port?: MergePort;
  points?: boolean;
  pointsOpen?: boolean;
  screen?: ScreenMode;
};

type View = {
  selected?: RowKey;
  status: SketchStatus;
  comparing: boolean;
  withdrawn?: Withdrawn;
  take: string;
  points: string;
};

const DRAWN: RowKey = 'b';

const LIST_WIDTH = 1100;

const QUESTION = 'Wo soll der Reset-Knopf der Zoom-Pille stehen?';

const foldedLabel = (count: number) =>
  count === 1 ? '1 unveränderter Zustand eingeklappt' : `${count} unveränderte Zustände eingeklappt`;

const treeOf = (key: string) =>
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
            ...(`components/${name}` === key ? { selected: true } : {}),
          })),
      },
      {
        title: 'Pages',
        open: true,
        parts: [
          { name: 'system', leaf: true },
          ...(key === SCREEN_KEY ? [{ name: 'sketches', leaf: true, selected: true }] : []),
        ],
      },
    ],
  });

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

const tag = async (label: string) =>
  (await badge.render({ badges: [{ label, variant: 'tonal', size: 'sm' }] })) as { body: string; styles: string };
const controlsOf = async () => ({
  discard: await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm', color: 'danger' }),
  chip: await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' }),
  pickers: {
    wide: await pickerOf('Runde 1 · Suche und Update'),
    narrow: await pickerOf('Runde 1 · Reset control: SDK button or own part'),
    edit: await pickerOf('Direkte Änderung'),
    screen: await pickerOf('Runde 2 · Port nach dem Merge'),
  },
  tags: {
    drawing: await sketchStatusBadge('drawing'),
    waiting: await sketchStatusBadge('waiting'),
    picked: await sketchStatusBadge('picked'),
    paused: await sketchStatusBadge('paused'),
    idle: await sketchStatusBadge('idle'),
    fresh: await tag('neu'),
  },
});

type Tags = Awaited<ReturnType<typeof controlsOf>>['tags'];

const statusMarkup = (status: SketchStatus, reason: boolean, tags: Tags) => {
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

const agentLine = (run: AgentProgress) =>
  html`<span
    class="flex min-w-0 items-center gap-space-2 text-ui-sm text-et-surface-muted whitespace-nowrap"
    data-sk-agent
    ${run.failed ? 'data-et-semantic-color="error"' : ''}
  >
    <span
      class="size-2 flex-none rounded-full bg-(--et-theme-color-primary-solid) ${run.failed ? '' : 'animate-pulse'}"
    ></span>
    ${modelName(run.by)}
    <span class="font-ui-medium ${run.failed ? 'text-(--et-theme-color-primary-solid)' : 'text-et-surface'}"
      >${run.task}</span
    >
    <span>· ${run.step} · ${run.since}</span>
  </span>`;

const MERGE_PORTS: Record<MergePort, { merged: string[]; since: string }> = {
  one: { merged: ['components/button'], since: 'seit 1 Min' },
  two: { merged: ['components/sketch-status-badge', 'elements/variant-cell'], since: 'seit 1 Min' },
};

const portLine = (port: MergePort) =>
  html`<span
    class="flex min-w-0 items-center gap-space-2 text-ui-sm text-et-surface-muted whitespace-nowrap"
    data-sk-merge-port
  >
    <span
      class="size-2 flex-none rounded-full bg-(--et-theme-color-primary-solid)"
      data-et-semantic-color="warning"
    ></span>
    <span class="truncate font-ui-medium text-et-surface"
      >Agent portiert nach Merge von ${MERGE_PORTS[port].merged.join(', ')}</span
    >
    <span>· ${MERGE_PORTS[port].since}</span>
  </span>`;

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

const pinFor = (row: Row) =>
  row.key === 'a'
    ? html`<span class="absolute top-space-1 right-space-1 z-1 flex in-data-sk-head-hidden:hidden" data-sk-pin
        >${pagePin}</span
      >`
    : '';

const headOf = (row: Row, view: View) => {
  const drawn = view.status === 'drawing' && row.key === DRAWN;
  const take = view.status === 'waiting' || view.status === 'picked' ? view.take : '';
  const withPoints =
    view.points && row.key === view.selected
      ? html`<span class="relative flex flex-wrap items-center gap-space-2">${take}${view.points}</span>`
      : take;
  const action = drawn ? drawingMark : withPoints;
  const mark = view.comparing && row.key !== 'current' ? comparingMark : '';
  if (isWithdrawn(row, view.withdrawn)) return rowHead(row, withdrawnMark, mark);
  return rowHead(row, action, mark) + (drawn ? '' : pinFor(row));
};

const gridRow = (part: SketchPart, row: Row, view: View) => {
  const drawn = view.status === 'drawing' && row.key === DRAWN;
  return html`<section
    class="sk-row grid grid-cols-[var(--sk-head)_minmax(0,1fr)] gap-space-5 rounded-control-md p-space-3 in-data-sk-head-hidden:grid-cols-[max-content_minmax(0,1fr)] in-data-sk-head-hidden:gap-space-2"
    data-sk-row="${row.key}"
    ${row.key === view.selected ? ' data-selected' : ''}
  >
    <div class="relative min-w-0">
      <span
        class="hidden w-fit items-center rounded-full px-space-2 py-0.5 text-ui-xs font-ui-medium text-et-surface shadow-[0_0_0_1px_var(--et-surface-border-solid)] in-data-sk-head-hidden:inline-flex"
        data-sk-head-tag
        >${row.key === 'current' ? 'Aktuell' : row.key}</span
      >
      <div class="in-data-sk-head-hidden:hidden" data-sk-head-full>${headOf(row, view)}</div>
    </div>
    <div class="min-w-0 ${isWithdrawn(row, view.withdrawn) ? 'opacity-60' : ''}">
      ${drawn ? drawingStage(row) : wrapStage(part, row, view.comparing)}
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

const gutter = (part: SketchPart, top: number) =>
  part.states
    .map(
      (state, index) =>
        html`<span
          class="sk-gutter relative z-2 flex items-center self-stretch bg-et-surface-bg pr-space-3 font-code text-(length:--sk-note) leading-[1.35] text-et-surface in-data-sk-head-hidden:text-transparent"
          data-sk-gutter
          data-et-skip="COVERED OFF-CENTRE"
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
    <span
      class="hidden w-fit items-center rounded-full px-space-2 py-0.5 text-ui-xs font-ui-medium text-et-surface shadow-[0_0_0_1px_var(--et-surface-border-solid)] in-data-sk-head-hidden:inline-flex"
      data-sk-head-tag
      >${row.key === 'current' ? 'Aktuell' : row.key}</span
    >
    <div class="in-data-sk-head-hidden:hidden" data-sk-head-full>${headOf(row, view)}</div>
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

const screenHead = (row: Row, at: number, view: View) =>
  html`<section
    class="sk-row relative min-w-0 rounded-control-md p-space-2"
    data-sk-row="${row.key}"
    style="grid-column: ${at}; grid-row: 1"
  >
    <span
      class="hidden w-fit items-center rounded-full px-space-2 py-0.5 text-ui-xs font-ui-medium text-et-surface shadow-[0_0_0_1px_var(--et-surface-border-solid)] in-data-sk-head-hidden:inline-flex"
      data-sk-head-tag
      >${row.key === 'current' ? 'Aktuell' : row.key}</span
    >
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
  return { wholeButton: await toggleOf('Ganzer Screen'), cropButton: await toggleOf('Ausschnitt') };
};

type Buttons = Awaited<ReturnType<typeof buttonsOf>>;

const screenGutter = (group: ChangeGroup, line: number, whole: boolean, buttons: Buttons) => {
  const { wholeButton, cropButton } = buttons;
  const [first = ''] = group.states;
  const count = group.states.length;
  return html`<div
    class="sk-gutter relative z-2 flex w-[calc(var(--sk-note)*15)] flex-col justify-center gap-space-1 self-stretch bg-et-surface-bg pr-space-3 text-(length:--sk-note) leading-[1.35]"
    data-sk-gutter
    data-et-skip="COVERED OFF-CENTRE"
    style="grid-column: 1; grid-row: ${line} / span 2"
  >
    <span class="font-code text-et-surface">${first}</span>
    ${count > 1 ? html`<span class="text-et-surface">${count} Zustände, gleicher Ausschnitt</span>` : ''}
    <span class="text-et-surface-muted" data-cc-reason
      >${reasonOf(group)}${whole ? '' : ` · ${zoomTextOf(cropOf(group.box))} vergrößert`}</span
    >
    <span class="mt-space-1 flex items-end gap-space-2">${locator(group)}${whole ? cropButton : wholeButton}</span>
  </div>`;
};

const shotsOf = async (group: ChangeGroup, whole: boolean) => {
  const state = group.states[0] ?? '';
  const [before, after] = await Promise.all([screenOf(state, false), screenOf(state, true)]);
  const marked = markedScreen(after.body, group.box);
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

const screenControl = async () => ({ body: '', styles: '' });

const zoomOf = (camera: Props['camera']): Zoom => (camera === 'fit' ? 'fit' : camera === '100' ? 1 : camera.zoom);
const startOf = (camera: Props['camera']) => (typeof camera === 'object' ? { x: camera.x, y: camera.y } : undefined);

export default definePart<Props>({
  note: 'A <part>@edit sketch (a direct edit without an ADR) has the rows old and new and no Verwerfen button: the server refuses a discard (EDIT-DISCARD-REFUSED), the header says to pick old to undo the edit or new to keep it. Eine Zeile je Variante, ganz oben Aktuell, bei einem neuen Teil ohne Aktuell und mit dem Badge neu. Links steht der Kopf: Variante, kurzer Modellname (Tooltip mit voller Kennung und Zeit), die Notiz und Übernehmen, das direkt die Merge-Ansicht öffnet; Übernehmen steht nur da, wenn der Sketch auf die Wahl wartet. Das Badge oben folgt dem echten Zustand: zeichnet, solange eine Variante gezeichnet wird, Wartet auf deine Wahl, wenn alle stehen und nichts gewählt ist, Variante gewählt, sobald eine Variante gewählt ist; was noch fehlt, steht als erster offener Punkt, sonst Pausiert oder Keine Aktivität. Die offenen Punkte des Sketches stehen im Kopf der gewählten Variante als Chip neben Übernehmen, auch für einen Teil, der noch keine gemergte Ansicht hat. Die Notiz wächst mit dem Zoom (15 px bei 100 %, nie unter 12 px bis Einpassen); weiter herausgezoomt skaliert der Kopf mit der Fläche, unter 9 px ist sein Text ausgeblendet. Rechts stehen die Zustände in einem Raster, jeder mit Namen (13 px mal Zoom, unter 9 px ausgeblendet). Ein Teil breiter als ein Viertel der Ansicht zeigt eine Matrix: eine Spalte je Variante, Aktuell zuerst, die Zustände als Zeilen, der Zustandsname einmal je Zeile links; beim Verschieben bleibt diese Spalte am linken Rand stehen. Einpassen nimmt Aktuell und die erste Variante, in der Matrix deren zwei Spalten; weitere erreicht man durch Verschieben. Solange der Vergleich läuft, sind alle Rahmen neutral und der Kopf zeigt vergleicht …; danach sind unveränderte Zustände gedimmt und der erste geänderte markiert. Varianten, die in jedem Zustand gleich Aktuell sind, liegen zusammen in einem zugeklappten Bereich unter den geänderten (in der Matrix eine schmale Spalte rechts), aufgeklappt wie vorher.',
  madeBy: ['claude-opus-5-5', 'gpt-6', 'claude-sonnet-5-5', 'design check'],
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
    'unchanged-matrix-open': { camera: { zoom: 0.2, x: -4000, y: 0 }, same: ['b', 'c'], sameOpen: true },
    'withdrawn-hidden': { camera: 'fit', part: 'narrow', withdrawn: 'hidden' },
    'withdrawn-shown': { camera: 'fit', part: 'narrow', withdrawn: 'shown' },
    'agent-round': { camera: 'fit', part: 'narrow', agent: 'round' },
    'agent-variant': { camera: 'fit', part: 'narrow', agent: 'variant' },
    'agent-failed': { camera: 'fit', part: 'narrow', agent: 'failed' },
    folded: { camera: 'fit', part: 'narrow', fold: 3, question: QUESTION },
    'question-only': { camera: 'fit', part: 'narrow', question: QUESTION },
    'port-after-merge': { camera: 'fit', part: 'narrow', port: 'one' },
    'port-after-merge-long': { camera: 'fit', part: 'narrow', port: 'two' },
    picked: { camera: 'fit', part: 'narrow', status: 'picked', selected: 'b' },
    'sketch-only-points': { camera: 'fit', part: 'narrow', fresh: true, status: 'picked', selected: 'b', points: true },
    'sketch-only-points-open': {
      camera: 'fit',
      part: 'narrow',
      fresh: true,
      status: 'picked',
      selected: 'b',
      points: true,
      pointsOpen: true,
    },
    'edit-sketch': { camera: 'fit', part: 'edit' },
    'change-crop': { camera: 'fit', part: 'narrow', screen: 'crop' },
    'change-crop-whole': { camera: 'fit', part: 'narrow', screen: 'whole' },
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
    agent,
    fold = 0,
    question = '',
    port,
    points = false,
    pointsOpen = false,
    screen,
  }) => {
    const { discard, chip, pickers, tags } = await controlsOf();
    const take = await takeButton();
    const run = agent ? AGENT_RUNS[agent] : undefined;
    const full = withSame(PARTS[kind], comparing ? [] : sameKeys);
    const rowStyles = await prepareShots(full);
    const part = fold > 0 ? { ...full, states: full.states.slice(0, full.states.length - fold) } : full;
    const side = await treeOf(screen ? SCREEN_KEY : part.key);
    const all = rowsOf(part, fresh);
    const rows = visibleRows(all, withdrawn);
    const hiddenCount = withdrawnCount(all, withdrawn);
    const same = comparing ? [] : rows.filter(isSame);
    const shown = rows.filter((row) => !same.includes(row));
    const pointsButton = points ? await pointsChip(pointsOpen) : undefined;
    const view: View = {
      selected,
      status,
      comparing,
      withdrawn,
      take: takeAction(take.body),
      points: pointsButton ? html`<span class="flex" data-sk-points>${pointsButton.body}</span>` : '',
    };
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
    const world = screen
      ? await screenWorld(view, screen)
      : transposed
        ? matrix(part, shown, same, view, sameOpen)
        : shown.map((row) => gridRow(part, row, view)).join('') + sameRows(part, same, view, sameOpen);
    const folded = screen ? UNCHANGED_COUNT : fold;
    const control = screen ? await screenControl() : { body: '', styles: '' };
    const toggle = await disclosurePart.render({ label: '', body: '', open: false });
    const content = html`<div
      class="relative isolate box-border flex h-full flex-col gap-space-4 overflow-hidden p-space-5 pl-[calc(var(--st-shell-inset-left,0px)+var(--space-5))]"
      data-sketches-page
    >
      <header
        class="absolute z-3 top-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))] right-space-5 flex items-center gap-space-3"
      >
        <span class="text-ui-lg font-ui-strong">${screen ? SCREEN_KEY : part.key}</span>
        ${fresh ? tags.fresh.body : ''} ${statusMarkup((run && !run.failed) || port ? 'drawing' : status, reason, tags)}
        <span class="flex-1"></span>
        <span class="w-56 flex-none" data-sk-view-toggle-room></span>
        ${
          kind === 'edit' && !screen
            ? html`<span class="text-ui-sm text-et-surface-muted whitespace-nowrap" data-sk-edit-hint
                >Kein Verwerfen: old macht die Änderung rückgängig, new behält sie</span
              >`
            : withAction(discard.body, 'emit:discard')
        }
      </header>
      ${
        question
          ? html`<p
              class="absolute z-2 top-14 right-space-5 left-[calc(var(--st-shell-inset-left)+var(--space-5))] m-0 truncate text-ui-md font-ui-medium text-et-surface"
              data-sk-question
            >
              ${question}
            </p>`
          : ''
      }
      <div
        class="zr-picker absolute z-2 ${question ? 'top-24' : 'top-14'} left-[calc(var(--st-shell-inset-left)+var(--space-5))] flex items-center gap-space-4"
      >
        ${pickers[screen ? 'screen' : kind].body} ${run ? agentLine(run) : ''} ${port ? portLine(port) : ''}
        ${control.body}
        ${showWithdrawn.body ? withAction(showWithdrawn.body, { action: 'emit:withdrawnToggle', on: '.et-switch' }) : ''}
      </div>
      <div
        class="absolute ${question ? 'top-37' : 'top-27'} right-0 bottom-space-5 left-0 box-border overflow-clip pr-space-5 pl-[calc(var(--st-shell-inset-left)+var(--space-5))]"
      >
        <div class="size-full" data-sk-rows>
          <div
            class="flex flex-col gap-space-2 pb-16 ${transposed ? 'w-max' : ''}"
            data-sk-rows-world
            data-w="${screen ? SCREEN_WIDTH : part.width}"
            data-cols="${screen ? SCREEN_ROWS.length : transposed ? columns : wrapColumns(part)}"
          >
            ${world}
            ${
              folded > 0
                ? html`<section class="sk-same rounded-control-md p-space-2" data-sk-folded>
                    ${html`<span class="flex items-center gap-space-3"><span class="text-ui-sm text-et-surface-muted">${foldedLabel(folded)}</span>${disclosure({ label: 'Alle Zustände zeigen', body: '', open: false, size: 'xs', action: 'emit:statesToggle' })}</span>`}
                  </section>`
                : ''
            }
          </div>
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
        control.styles +
        (toggle as { styles: string }).styles +
        take.styles +
        (pointsButton?.styles ?? '') +
        rowStyles +
        Object.values(tags)
          .map((entry) => entry.styles)
          .join('') +
        variantCellStyles +
        kit +
        styles +
        below,
    });
  },
});
