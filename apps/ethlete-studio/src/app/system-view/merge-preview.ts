import { Observable, connect, interval, map, merge, startWith, takeUntil } from 'rxjs';
import { SketchAddress, designAnswer$ } from '../../host/design';
import { FrameOutline } from '../components/design-canvas/canvas-pin';

export type CompareRect = { x: number; y: number; width: number; height: number };

/** One state of a part that shows the sketch target, with the target's outlines now and after the merge. */
export type CompareRow = {
  part: string;
  state: string;
  preset?: string;
  width?: number;
  outlines: { now: CompareRect[]; merged: CompareRect[] };
  error?: string;
};

export type SketchCompare = { target: string; variant: string; changed: CompareRow[]; unchanged: CompareRow[] };

export type SketchCompareAddress = SketchAddress & {
  variant: string;
  size?: string | null;
  surface?: string;
  color?: string;
};

export type UnchangedLine = { part: string; text: string };

export const MERGE_COLUMNS = ['now', 'merged'] as const;

export type MergeColumn = (typeof MERGE_COLUMNS)[number];

export const mergeFrameIdOf = ({ column, part, state }: { column: MergeColumn; part: string; state: string }) =>
  `${column} ${part} ${state}`;

const sketchCompareUrl = ({ port, product, sketch, variant, size, surface, color }: SketchCompareAddress) => {
  const query = new URLSearchParams({ product, sketch, variant });

  if (size) query.set('size', size);
  if (surface) query.set('surface', surface);
  if (color) query.set('color', color);

  return `http://localhost:${port}/__design/sketch-compare?${query}`;
};

/** Compares every state that shows the sketch target before and after merging `variant`; one answer once all are drawn. */
export const sketchCompare$ = (address: SketchCompareAddress): Observable<SketchCompare> =>
  designAnswer$<SketchCompare>(sketchCompareUrl(address));

/** Emits `pending(seconds)` at once and every second after, until `answer$` emits; then what `answer$` emits. */
export const whileWaiting$ = <T>(answer$: Observable<T>, pending: (seconds: number) => T): Observable<T> =>
  answer$.pipe(
    connect((answered$) =>
      merge(
        interval(1000).pipe(
          map((tick) => tick + 1),
          startWith(0),
          map(pending),
          takeUntil(answered$),
        ),
        answered$,
      ),
    ),
  );

/** For example "Comparing 5 parts now and after the merge… 12 s"; the seconds show from the first one. */
export const comparingTextOf = ({ parts, seconds }: { parts: number; seconds: number }) =>
  `Comparing ${parts} ${parts === 1 ? 'part' : 'parts'} now and after the merge…${seconds > 0 ? ` ${seconds} s` : ''}`;

/** One line per part, for example "2 states of pages/library without visible change". */
export const unchangedLinesOf = (rows: CompareRow[]): UnchangedLine[] => {
  const counts = new Map<string, number>();

  for (const row of rows) counts.set(row.part, (counts.get(row.part) ?? 0) + 1);

  return [...counts].map(([part, count]) => ({
    part,
    text: `${count} ${count === 1 ? 'state' : 'states'} of ${part} without visible change`,
  }));
};

/** The outlines of the target on each frame of the merge preview. */
export const mergeOutlinesOf = (rows: CompareRow[]): FrameOutline[] =>
  rows.flatMap((row) =>
    MERGE_COLUMNS.flatMap((column) =>
      row.outlines[column].map((rect) => ({
        frameId: mergeFrameIdOf({ column, part: row.part, state: row.state }),
        ...rect,
      })),
    ),
  );

/** The name of a part without its layer, for example `card` for `components/card`. */
export const partNameOf = (key: string) => key.slice(key.indexOf('/') + 1);
