import { Observable, catchError, map, of } from 'rxjs';
import { DesignRefusalError, MergeNeedsRebaseError, SketchAddress, pickSketch$ } from '../../host/design';
import { MERGE_LABELS, SKETCHES_LABELS } from '../i18n/sketches-labels';
import { refusalMessageOf } from './inventory';

export type SketchPickRequest = { address: SketchAddress; variant: string; discardSubSketches: boolean };

/** `merged` is false for a refused pick and for a pick that opened sub-sketches; `error` names a refusal. */
export type SketchPickOutcome = { merged: boolean; error: string | null };

export const pickErrorOf = (error: unknown) =>
  error instanceof MergeNeedsRebaseError
    ? MERGE_LABELS.needsRebase(error.changed)
    : error instanceof DesignRefusalError && error.reason === 'sub-sketches-open'
      ? SKETCHES_LABELS.waitsOnSubSketches(error.findings)
      : refusalMessageOf(error);

export const sketchPickOutcome$ = ({
  address,
  variant,
  discardSubSketches,
}: SketchPickRequest): Observable<SketchPickOutcome> =>
  pickSketch$(address, { variant, discardSubSketches }).pipe(
    map(({ subSketches }) => ({ merged: subSketches.length === 0, error: null })),
    catchError((error: unknown) => of({ merged: false, error: pickErrorOf(error) })),
  );
