import { Observable } from 'rxjs';
import { designAnswer$ } from '../../host/design';
import { FrameOutline } from '../components/design-canvas/canvas-pin';
import { CompareRect, SketchCompareAddress } from './merge-preview';

/** One state of the sketched part: the box of the pixels the variant changes (`null` for none), `new`, or why it was not drawn. */
export type StateDiff =
  { state: string; box: CompareRect | null } | { state: string; new: true } | { state: string; error: string };

export type VariantDiff = { target: string; variant: string; preset?: string; width?: number; states: StateDiff[] };

export type DiffLine = { state: string; text: string; box: CompareRect | null; title?: string; unchanged?: true };

const variantDiffUrl = ({ port, product, sketch, variant, size, surface, color }: SketchCompareAddress) => {
  const query = new URLSearchParams({ product, sketch, variant });

  if (size) query.set('size', size);
  if (surface) query.set('surface', surface);
  if (color) query.set('color', color);

  return `http://localhost:${port}/__design/sketch-diff?${query}`;
};

/** The pixels `variant` changes per state of the sketched part against the product now, at rest. */
export const variantDiff$ = (address: SketchCompareAddress): Observable<VariantDiff> =>
  designAnswer$<VariantDiff>(variantDiffUrl(address));

/** One line per state, for example "default · 8 × 4 px" or "empty · no pixel change". */
export const diffLinesOf = (diff: VariantDiff): DiffLine[] =>
  diff.states.map((entry) =>
    'box' in entry
      ? {
          state: entry.state,
          text: entry.box
            ? `${entry.state} · ${entry.box.width} × ${entry.box.height} px`
            : `${entry.state} · no pixel change`,
          box: entry.box,
          ...(entry.box ? {} : { unchanged: true as const }),
        }
      : 'new' in entry
        ? { state: entry.state, text: `${entry.state} · new`, box: null }
        : { state: entry.state, text: `${entry.state} · not drawn`, box: null, title: entry.error },
  );

/** The summary of a variant's lines, for example "2 of 8 states change pixels", and the lines worth listing. */
export const diffSummaryOf = (lines: DiffLine[]) => {
  const listed = lines.filter((line) => !line.unchanged);
  const states = `${lines.length} ${lines.length === 1 ? 'state' : 'states'}`;

  return {
    text:
      listed.length === 0
        ? `No pixel change in ${states}`
        : `${listed.length} of ${states} ${listed.length === 1 ? 'differs' : 'differ'} in pixels`,
    listed,
  };
};

/** The outline of a changed box on the matrix frame of `variant` and `state` at rest. */
export const diffOutlineOf = ({
  variant,
  state,
  box,
}: {
  variant: string;
  state: string;
  box: CompareRect;
}): FrameOutline => ({
  frameId: `${variant} ${state}`,
  ...box,
});
