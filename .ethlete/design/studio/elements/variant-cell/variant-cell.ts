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
  sameAsRest?: string[];
  place?: string;
  loading?: boolean;
  sample?: string;
  height?: number;
  shown?: number;
  crop?: string;
  mark?: { left: number; top: number; width: number; height: number };
  stacked?: string[];
  selected?: boolean;
  overlay?: string;
};

const STACK_INSETS = [6, 12];

export const variantCellStyles = styles + loaderStyles;

const loadingBadge = html`<span
  class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-space-1 text-ui-xs text-et-surface-muted [@container(height<14px)]:hidden"
  data-loading-badge
  >${spinner({ diameter: 14, strokeWidth: 1.75 })}<span class="[@container(height<18px)]:hidden"
    >${CANVAS_LABELS.loading}</span
  ></span
>`;

const pending = (height?: number) =>
  html`<div class="${height === undefined ? 'h-30' : 'h-full'}" aria-busy="true" data-loading></div>`;

const pinAt = (pin: { x: number; y: number; initials?: string; selected?: boolean }) =>
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
  stacked = [],
  selected = false,
  same = false,
  overlay = '',
}: Props) => {
  const sized = shown === undefined ? '' : `--sk-shown: ${shown}px`;
  const stackEdges = STACK_INSETS.map(
    (inset) =>
      html`<div
        class="rounded-b-control-sm bg-et-surface-bg sk-fit"
        style="height: 5px; margin-inline: ${inset}px"
        data-sk-crop-stack
      ></div>`,
  ).join('');
  return html`<div class="relative row-start-2 flex min-w-0 flex-col self-start">
    <div class="contents" ${slot('overlay')}>${overlay}</div>
    <div
      class="relative w-(--sk-frame) overflow-clip ${shown === undefined ? '' : '@container-size'} [overflow-clip-margin:8px] sk-fit ${stacked.length > 0 ? 'z-1' : ''} ${
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
          <div class="contents" ${slot('shot')}>${loading ? pending(height) : shot}</div>
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
      ${loading ? loadingBadge : ''}
      <span class="pointer-events-none absolute inset-0" data-frame-border></span>
    </div>
    ${
      stacked.length > 0
        ? html`${stackEdges}<span
              class="mt-space-1 w-(--sk-frame) font-code text-(length:--sk-label) leading-[1.35] text-et-surface-muted wrap-anywhere"
              data-sk-stack-states
              >${SKETCHES_LABELS.stackedStates(stacked)}</span
            >`
        : ''
    }
  </div>`;
};

export const variantCell = (props: Props) => {
  const { state, same = false, sameAsRest = [], place = '' } = props;
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
      >${sameAsRest.length > 0 ? html`<span class="min-w-0 font-code text-(length:--sk-label) leading-[1.35] text-et-surface-muted wrap-anywhere" data-sk-same-as-rest>${SKETCHES_LABELS.sameAsRest(sameAsRest, state)}</span>` : ''}</span
    >
    ${frame(props)}
  </div>`;
};

const demo = html`<div class="flex h-full items-center justify-center bg-et-surface-bg text-ui-lg text-et-surface">
  Speichern
</div>`;

const base: Props = { state: 'default', width: 240, height: 120, shot: demo };
const crop = {
  shown: 60,
  crop: 'scale(2) translate(-60px, -45px)',
  mark: { left: 72, top: 46, width: 96, height: 28 },
};

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/variant-cell/variant-cell.component.ts',
  note: 'One state of a sketch variant in the sketch matrix: the state name above, then the part drawn at its own width and scaled into the frame. A state the variant leaves as it was is dimmed and reads unverändert; a base-state cell names the states folded as drawn like it after its own state name (hover, active = default). The host sets the frame width, the scale and the label size (`--sk-frame`, `--sk-scale`, `--sk-label`) and places the cell in its grid. While its render is not there yet, the frame is an empty, aria-busy box at the default height with the Lädt mark (the SDK spinner at 14 px and Lädt) centered in it, losing the text below 18px of frame height and the spinner below 14px; the label row is the same loading or not. A cropped cell shows the change magnified, with the accent crop mark on it and, when it stands for a group of states, two card edges under the frame like a stack and the names of the folded states below (+ active, focus-visible); the host places comment pins on their point in the shot through the overlay slot.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'design check'],
  widths: [240],
  states: {
    changed: base,
    unchanged: { ...base, state: 'hover', same: true },
    'same-as-rest': { ...base, sameAsRest: ['hover', 'active'] },
    loading: { ...base, state: 'active', loading: true, shown: 120 },
    'loading-small': { ...base, state: 'focus-visible', loading: true, height: 16, shown: 16 },
    cropped: { ...base, state: 'hover', ...crop },
    stacked: { ...base, state: 'hover', ...crop, stacked: ['active', 'focus-visible'] },
    pinned: {
      ...base,
      overlay: [
        { x: 60, y: 30 },
        { x: 180, y: 90, selected: true },
      ]
        .map(pinAt)
        .join(''),
    },
  },
  describe: {
    changed:
      'A changed state cell with default above the Speichern shot at its own size; check that the label sits on the first row and the shot fills the 240px frame.',
    unchanged:
      'A state the variant leaves as it was; check that the whole cell is dimmed and the label reads hover · unverändert.',
    'same-as-rest':
      'A base-state cell standing in for the folded states the variant draws the same; check that hover, active = default follows default, muted.',
    cropped:
      'A cell cropped to its change; check the magnified Speichern fills the frame and the accent crop mark frames it.',
    stacked:
      'A cropped cell standing for a group of states; check the two card edges under the frame read as a stack and + active, focus-visible names the folded states below it.',
    pinned:
      'A cell with two comment pins; check that each pin point sits on its spot in the shot and the selected pin shows the accent fill.',
    'loading-small':
      'A loading cell whose frame is 16px tall; check that only the spinner shows, with no Lädt text, and nothing leaves the frame.',
    loading:
      'A cell whose shot still loads; check the spinner with Lädt centered in the empty busy frame and the label row unchanged.',
  },
  motions: {
    loading: { from: 'loading', to: 'loading' },
    'loading-small': { from: 'loading-small', to: 'loading-small' },
  },
  controls: {},
  sample: { id: 'sample', marks: ['look', 'same'] },
  instant: 'A cell dims at once when the comparison ends.',
  frame: (body) =>
    html`<div
      class="grid grid-cols-(--sk-frame) gap-y-space-1"
      style="--sk-frame: 240px; --sk-scale: 1; --sk-label: 13px"
    >
      ${body}
    </div>`,
  render: (props: Props) => drawing({ body: variantCell(props), styles: variantCellStyles }),
});
