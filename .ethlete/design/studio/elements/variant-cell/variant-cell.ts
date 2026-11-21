import { definePart, drawing, html, slot } from '@design-system';
import { loaderStyles, spinner } from '@ethlete/components/design/loader';
import { commentPinMark } from '@system/components/comment-pin';
import styles from './variant-cell.css?inline';
import { CANVAS_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/canvas-labels';
import { SKETCHES_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';

type Props = {
  state: string;
  width: number;
  shot: string;
  look?: string;
  same?: boolean;
  first?: boolean;
  marked?: boolean;
  place?: string;
  loading?: boolean;
  sample?: string;
  height?: number;
  shown?: number;
  crop?: string;
  mark?: { left: number; top: number; width: number; height: number };
  stacked?: boolean;
  selected?: boolean;
  pins?: { x: number; y: number; initials?: string; selected?: boolean }[];
};

const STACK_INSETS = [32, 64];
const SELECTED_RING = 'outline-2 -outline-offset-2 outline-(--et-theme-color-primary-solid) outline-solid';

export const variantCellStyles = styles + loaderStyles;

const loadingBadge = html`<span
  class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-space-1 text-ui-xs text-et-surface-muted"
  data-loading-badge
  >${spinner({ diameter: 14, strokeWidth: 1.75 })}${CANVAS_LABELS.loading}</span
>`;

const pending = html`<div class="h-30" aria-busy="true" data-loading></div>`;

const pinAt = (pin: NonNullable<Props['pins']>[number]) =>
  html`<span
    class="absolute z-10 flex -translate-y-full"
    style="left: calc(${pin.x}px * var(--sk-scale)); top: calc(${pin.y}px * var(--sk-scale))"
    data-sk-pin
    >${commentPinMark({ author: 'Hanna', initials: pin.initials ?? 'H', selected: pin.selected })}</span
  >`;

const frame = ({
  width,
  shot,
  look = '',
  loading = false,
  height,
  shown = height,
  crop,
  mark,
  stacked = false,
  selected = false,
  same = false,
  pins = [],
}: Props) => {
  const sized = shown === undefined ? '' : `--sk-shown: ${shown}px`;
  const stackBars = STACK_INSETS.map(
    (inset) =>
      html`<div
        class="h-5 rounded-b-control-md bg-et-surface-bg shadow-[0_0_0_2px_var(--et-surface-border-solid)]"
        style="margin-inline: ${inset}px"
        data-sk-crop-stack
      ></div>`,
  ).join('');
  return html`<div class="relative row-start-2 flex min-w-0 flex-col self-start ${stacked ? 'sk-fit' : ''}">
    ${pins.map(pinAt).join('')}${loading ? loadingBadge : ''}
    <div
      class="relative w-(--sk-frame) overflow-clip [overflow-clip-margin:8px] ${stacked ? 'z-1' : 'sk-fit'} ${
        shown === undefined ? '' : 'h-[calc(var(--sk-shown)*var(--sk-scale))]'
      } ${same ? 'opacity-50' : ''}"
      style="${sized}"
      data-sk-frame
      ${selected ? 'data-selected' : ''}
      ${crop ? 'data-sk-cropped' : ''}
    >
      <div
        class="pointer-events-none w-(--w) origin-top-left scale-(--sk-scale) ${look} ${crop ? 'overflow-hidden' : ''}"
        data-sk-fit-inner
        ${crop ? 'data-et-skip="CLIPPED"' : ''}
        style="--w: ${width}px; ${shown === undefined ? '' : 'height: ' + shown + 'px'}"
      >
        <div
          class="relative origin-top-left"
          style="${height === undefined ? '' : 'height: ' + height + 'px;'} ${crop ? 'transform: ' + crop : ''}"
        >
          <div class="contents" ${slot('shot')}>${loading ? pending : shot}</div>
          ${
            mark
              ? html`<span
                  class="pointer-events-none absolute rounded-control-sm border-2 border-et-theme"
                  style="left: ${mark.left}px; top: ${mark.top}px; width: ${mark.width}px; height: ${mark.height}px"
                  data-sk-crop-mark
                ></span>`
              : ''
          }
        </div>
      </div>
      <span class="pointer-events-none absolute inset-0 ${selected ? SELECTED_RING : ''}" data-frame-border></span>
    </div>
    ${
      stacked
        ? html`<div style="height: calc(${STACK_INSETS.length * 20}px * var(--sk-scale))"></div>
            <div class="absolute top-0 left-0 origin-top-left scale-(--sk-scale)" style="width: ${width}px">
              <div style="height: ${shown ?? 0}px"></div>
              ${stackBars}
            </div>`
        : ''
    }
  </div>`;
};

export const variantCell = (props: Props) => {
  const { state, same = false, first = false, marked = false, place = '' } = props;
  return html`<div
    class="row-span-2 grid min-w-0 grid-rows-subgrid gap-y-space-1"
    data-sk-state="${state}"
    style="${place}"
  >
    <span
      class="relative row-start-1 flex w-0 min-w-full flex-wrap items-center gap-x-space-2 in-data-sk-labels-hidden:hidden ${same ? 'opacity-50' : ''}"
      data-sk-label
      ><span
        class="min-w-0 font-code text-(length:--sk-label) leading-[1.35] wrap-anywhere ${
          same ? 'text-et-surface-muted' : 'text-et-surface'
        }"
        ><span class="in-data-sk-matrix:hidden">${state}${same ? ' · ' : ''}</span
        >${same ? SKETCHES_LABELS.unchanged : ''}</span
      >${marked ? html`<span class="rounded-full bg-et-theme px-space-2 text-ui-xs font-ui-medium text-et-theme-ink" data-sk-changed-mark>geändert</span>` : ''}${first ? html`<span class="text-ui-xs font-ui-medium text-et-surface">${SKETCHES_LABELS.firstChange}</span>` : ''}</span
    >
    ${frame(props)}
  </div>`;
};

const demo = html`<div class="flex h-30 items-center justify-center bg-et-surface-bg text-ui-lg text-et-surface">
  Speichern
</div>`;

const base: Props = { state: 'rest', width: 480, shot: demo };

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/variant-cell/variant-cell.component.ts',
  note: 'One state of a sketch variant in the sketch matrix: the state name above, then the part drawn at its own width and scaled into the frame. A state the variant leaves as it was is dimmed and reads unverändert; the first state it changes carries erste Änderung. The host sets the frame width, the scale and the label size (`--sk-frame`, `--sk-scale`, `--sk-label`) and places the cell in its grid. While its render is not there yet, the frame is an empty, aria-busy box at the default height with the Lädt mark (the SDK spinner at 14 px and Lädt) centered in it; the label row is the same loading or not. A cropped cell shows the change magnified, with the accent crop mark on it and, when it stands for a group of states, two short bars under the frame; a selected cell draws the accent outline inside the frame; comment pins sit on their point in the shot.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'design check'],
  widths: [240],
  states: {
    changed: base,
    first: { ...base, first: true },
    marked: { ...base, marked: true },
    unchanged: { ...base, same: true },
    loading: { ...base, loading: true },
    selected: { ...base, height: 120, selected: true },
    cropped: {
      ...base,
      height: 120,
      shown: 60,
      crop: 'scale(2) translate(-40px, -30px)',
      mark: { left: 36, top: 26, width: 80, height: 40 },
    },
    stacked: {
      ...base,
      height: 120,
      shown: 60,
      crop: 'scale(2) translate(-40px, -30px)',
      mark: { left: 36, top: 26, width: 80, height: 40 },
      stacked: true,
    },
    pinned: {
      ...base,
      height: 120,
      pins: [
        { x: 120, y: 40 },
        { x: 360, y: 90, selected: true },
      ],
    },
  },
  describe: {
    changed:
      'A changed state cell with rest above the half-scale Speichern shot; check that the label sits on the first row and the shot fits the 240px frame.',
    first: 'The first changed state; check the erste Änderung mark beside the state name, on one line with it.',
    marked: 'A changed cell inside a row of unchanged neighbours; check that the cell stands out from the dimmed ones.',
    unchanged:
      'A state the variant leaves as it was; check that the whole cell is dimmed and the label reads rest · unverändert.',
    selected: 'The cell whose frame is selected; check the 2px accent outline inset in the frame.',
    cropped:
      'A cell cropped to its change; check the magnified change fills the frame and the accent crop mark frames it.',
    stacked:
      'A cropped cell standing for a group of states; check the two shorter bars under the frame that read as a stack.',
    pinned:
      'A cell with two comment pins; check that each pin point sits on its spot in the shot and the selected pin shows the accent fill.',
    loading:
      'A cell whose shot still loads; check the spinner with Lädt centered in the empty busy frame and the label row unchanged.',
  },
  motions: { loading: { from: 'loading', to: 'loading' } },
  controls: {},
  sample: { id: 'sample', marks: ['look', 'same', 'first'] },
  instant: 'A cell dims or gains its mark at once when the comparison ends.',
  frame: (body) =>
    html`<div
      class="grid grid-cols-(--sk-frame) gap-y-space-1"
      style="--sk-frame: 240px; --sk-scale: 0.5; --sk-label: 13px"
    >
      ${body}
    </div>`,
  render: (props: Props) => drawing({ body: variantCell(props), styles: variantCellStyles }),
});
