import { definePart, drawing, html, slot } from '@design-system';
import { loaderStyles, spinner } from '@ethlete/components/design/loader';
import styles from './variant-cell.css?inline';

type Props = {
  state: string;
  width: number;
  shot: string;
  look?: string;
  same?: boolean;
  first?: boolean;
  place?: string;
  loading?: boolean;
  sample?: string;
};

export const variantCellStyles = styles + loaderStyles;

const loadingBadge = html`<span
  class="flex shrink-0 items-center gap-space-1 text-ui-xs text-et-surface-muted"
  data-loading-badge
  data-et-skip="CLIPPED"
  >${spinner({ diameter: 14, strokeWidth: 1.75 })}Lädt</span
>`;

const pending = html`<div class="h-30" aria-busy="true" data-loading></div>`;

const frame = ({ width, shot, look = '', loading = false }: Props) =>
  html`<div class="sk-fit relative row-start-2 w-(--sk-frame) overflow-clip [overflow-clip-margin:8px]" data-sk-frame>
    <div
      class="w-(--w) origin-top-left scale-(--sk-scale) ${look}"
      data-sk-fit-inner
      style="--w: ${width}px"
      ${slot('shot')}
    >
      ${loading ? pending : shot}
    </div>
  </div>`;

export const variantCell = (props: Props) => {
  const { state, same = false, first = false, place = '', loading = false } = props;
  return html`<div
    class="row-span-2 grid min-w-0 grid-rows-subgrid gap-y-space-1 ${same ? 'opacity-50' : ''}"
    data-sk-state="${state}"
    style="${place}"
  >
    <span
      class="row-start-1 flex min-w-0 flex-wrap items-center gap-x-space-2 in-data-sk-labels-hidden:hidden"
      data-sk-label
      ><span
        class="min-w-0 font-code text-(length:--sk-label) leading-[1.35] wrap-anywhere ${
          same ? 'text-et-surface-muted' : 'text-et-surface'
        }"
        ><span class="in-data-sk-matrix:hidden">${state}${same ? ' · ' : ''}</span>${same ? 'unverändert' : ''}</span
      >${first ? html`<span class="text-ui-xs font-ui-medium text-et-surface">erste Änderung</span>` : ''}${loading ? loadingBadge : ''}</span
    >
    ${frame(props)}
  </div>`;
};

const demo = html`<div class="flex h-30 items-center justify-center bg-et-surface-bg text-ui-lg text-et-surface">
  Speichern
</div>`;

const base: Props = { state: 'rest', width: 480, shot: demo };

export default definePart({
  note: 'One state of a sketch variant in the sketch matrix: the state name above, then the part drawn at its own width and scaled into the frame. A state the variant leaves as it was is dimmed and reads unverändert; the first state it changes carries erste Änderung. The host sets the frame width, the scale and the label size (`--sk-frame`, `--sk-scale`, `--sk-label`) and places the cell in its grid. While its render is not there yet, the frame is an empty, aria-busy box at the default height and the label row carries the Lädt mark the canvas frames show in a loading frame head: the SDK spinner at 14 px and Lädt.',
  madeBy: ['claude-opus-5-5'],
  widths: [240],
  states: {
    changed: base,
    first: { ...base, first: true },
    unchanged: { ...base, same: true },
    loading: { ...base, loading: true },
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
