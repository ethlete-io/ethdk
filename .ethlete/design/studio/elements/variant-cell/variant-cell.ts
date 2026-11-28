import { definePart, drawing, html, slot } from '@design-system';
import { control } from '@ethlete/components/design/control';
import styles from './variant-cell.css?inline';
import { CANVAS_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/canvas-labels';
import { SKETCHES_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';

type MarkBox = { left: number; top: number; width: number; height: number };
type Arrow = { x1: number; y1: number; x2: number; y2: number; head: string };

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
  marks?: (MarkBox & { from?: MarkBox })[];
  arrows?: Arrow[];
  stacked?: string[];
  selected?: boolean;
  overlay?: string;
};

const STACK_INSETS = [6, 12];

const moveArrows = (arrows: Arrow[]) =>
  arrows.length === 0
    ? ''
    : html`<svg
        class="pointer-events-none absolute top-0 left-0 size-px overflow-visible"
        aria-hidden="true"
        data-et-drawing
        data-sk-move-arrow
      >
        ${arrows
          .map(
            (arrow) =>
              html`<line
                  class="stroke-et-tone-fill"
                  x1="${arrow.x1}"
                  y1="${arrow.y1}"
                  x2="${arrow.x2}"
                  y2="${arrow.y2}"
                  stroke-width="2"
                  stroke-linecap="round"
                ></line
                ><polygon class="fill-et-tone-fill" points="${arrow.head}"></polygon>`,
          )
          .join('')}
      </svg>`;

export const variantCellStyles = styles;

const loadingBadge = html`<span
  class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-space-1 text-ui-xs text-et-surface-text-muted [@container(height<14px)]:hidden"
  data-loading-badge
  ><span class="[@container(height<18px)]:hidden">${CANVAS_LABELS.loading}</span></span
>`;

const pending = (height?: number) =>
  html`<div
    class="${height === undefined ? 'h-30' : 'h-full'} animate-pulse bg-et-surface-tint/8 motion-reduce:animate-none"
    aria-busy="true"
    data-loading
  ></div>`;

const stackButton = (stacked: string[]) =>
  html`<button
    class="mt-space-1 w-(--sk-frame) cursor-pointer text-left text-(length:--sk-label) leading-[1.35] text-et-surface-text-muted wrap-anywhere"
    type="button"
    aria-expanded="false"
    data-et-skip="WRAP"
    data-sk-stack-states
  >
    <span>${SKETCHES_LABELS.stackedStates(stacked)}</span>
  </button>`;

const frame = ({
  width,
  shot,
  look = '',
  loading = false,
  height,
  shown = height,
  crop,
  marks = [],
  arrows = [],
  stacked = [],
  selected = false,
  same = false,
  overlay = '',
}: Props) => {
  const sized = shown === undefined ? '' : `--sk-shown: ${shown}px`;
  const stackEdges = STACK_INSETS.map(
    (inset) =>
      html`<div
        class="rounded-b-control-sm bg-et-surface-background sk-fit"
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
          ${marks
            .map(
              (mark) =>
                html`${
                    mark.from
                      ? html`<span
                          class="pointer-events-none absolute rounded-control-sm border-2 border-dashed border-et-tone-fill opacity-70"
                          style="left: ${mark.from.left}px; top: ${mark.from.top}px; width: ${mark.from.width}px; height: ${mark.from.height}px"
                          data-sk-move-from
                        ></span>`
                      : ''
                  }<span
                    class="pointer-events-none absolute rounded-control-sm border-2 border-et-tone-fill"
                    style="left: ${mark.left}px; top: ${mark.top}px; width: ${mark.width}px; height: ${mark.height}px"
                    data-sk-crop-mark
                  ></span>`,
            )
            .join('')}
          ${moveArrows(arrows)}
        </div>
      </div>
      ${loading ? loadingBadge : ''}
      <span class="pointer-events-none absolute inset-0" data-frame-border></span>
    </div>
    ${stacked.length > 0 ? html`${stackEdges}${control(stackButton(stacked), 'names')}` : ''}
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
          same ? 'text-et-surface-text-muted' : 'text-et-surface-text'
        }"
        ><span class="in-data-sk-matrix:hidden">${state}${same ? ' · ' : ''}</span
        >${same ? SKETCHES_LABELS.unchanged : ''}</span
      >${sameAsRest.length > 0 ? html`<span class="min-w-0 font-code text-(length:--sk-label) leading-[1.35] text-et-surface-text-muted wrap-anywhere" data-sk-same-as-rest>${SKETCHES_LABELS.sameAsRest(sameAsRest, state)}</span>` : ''}</span
    >
    ${frame(props)}
  </div>`;
};

const demo = html`<div
  class="flex h-full items-center justify-center bg-et-surface-background text-ui-lg text-et-surface-text"
>
  Speichern
</div>`;

const base: Props = { state: 'default', width: 240, height: 120, shot: demo };
const moved = {
  shot: html`<div class="relative h-full bg-et-surface-background">
    <span
      class="absolute flex items-center justify-center rounded-control-sm text-ui-md text-et-surface-text shadow-[0_0_0_1px_var(--et-surface-border)]"
      style="left: 144px; top: 70px; width: 84px; height: 32px"
      >Speichern</span
    >
  </div>`,
  marks: [{ left: 140, top: 66, width: 92, height: 40, from: { left: 8, top: 14, width: 92, height: 40 } }],
  arrows: [{ x1: 103.7, y1: 53.6, x2: 127, y2: 62.7, head: '136.3,66.4 125.1,67.4 128.8,58.1' }],
};
const crop = {
  shown: 60,
  crop: 'scale(2) translate(-60px, -45px)',
  marks: [{ left: 72, top: 46, width: 96, height: 28 }],
};

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/variant-cell/variant-cell.component.ts',
  note: 'One state of a sketch variant in the sketch matrix: the state name above, then the part drawn at its own width and scaled into the frame. A state the variant leaves as it was is dimmed and reads unverändert; a base-state cell names the states folded as drawn like it after its own state name (hover, active = default). The host sets the frame width, the scale and the label size (`--sk-frame`, `--sk-scale`, `--sk-label`) and places the cell in its grid. While its render is not there yet, the frame is an aria-busy skeleton box at the default height, filled with the surface tint and fading softly in and out (opacity only, static under reduced motion), with the muted Lädt text centered in it and no spinner, losing the text below 18px of frame height and the mark below 14px; the label row is the same loading or not. A cropped cell shows the change magnified, with an accent crop mark on each changed area (a part that only moved gets one solid mark on its new place, a dashed one on its old place and an accent arrow from the old to the new) and, when it stands for a group of states, two card edges under the frame like a stack and one plain line below (+ 2 weitere Zustände sehen genauso aus. Klick zeigt die Namen.) that is a button: a click opens the folded state names under it, a second click closes them; the host places comment pins on their point in the shot through the overlay slot.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'design check'],
  controls: { names: { kind: 'button', input: ['pointer', 'keyboard'] } },
  widths: [240],
  states: {
    changed: base,
    unchanged: { ...base, state: 'hover', same: true },
    'same-as-rest': { ...base, sameAsRest: ['hover', 'active'] },
    loading: { ...base, state: 'active', loading: true, shown: 120 },
    'loading-small': { ...base, state: 'focus-visible', loading: true, height: 16, shown: 16 },
    cropped: { ...base, state: 'hover', ...crop },
    moved: { ...base, state: 'hover', ...moved },
    stacked: { ...base, state: 'hover', ...crop, stacked: ['active', 'focus-visible'] },
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
    moved:
      'A cell whose part only moved; check the old place has a dashed accent mark, the new place a solid one, and one accent arrow runs from edge to edge between them.',
    stacked:
      'A cropped cell standing for a group of states; check the two card edges under the frame read as a stack and the plain line below counts the folded states and says that hovering it shows their names.',
    'loading-small':
      'A loading cell whose frame is 16px tall; check that only the pulsing tint fill shows, with no Lädt text, and nothing leaves the frame.',
    loading:
      'A cell whose shot still loads; check the pulsing tint skeleton with Lädt centered in the busy frame and the label row unchanged.',
  },
  motions: {
    loading: { from: 'loading', to: 'loading' },
    'loading-small': { from: 'loading-small', to: 'loading-small' },
  },
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
