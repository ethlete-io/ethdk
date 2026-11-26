import { CallMatch, ReviewedRow, callOfRow, callTranscriptExcerpt } from '@ethlete/timetrack';
import { Observable, map, of } from 'rxjs';
import { HostPorts } from '../../host';
import { transcriptBetween$ } from '../transcript-chunks';

/** The excerpt of its own call's transcript a call row carries, or `undefined` where nothing was heard. */
export const callTranscriptOf$ = (options: {
  ports: HostPorts;
  row: Pick<ReviewedRow, 'from' | 'to' | 'laneKey'>;
  calls: readonly CallMatch[];
}): Observable<string | undefined> => {
  const { row } = options;
  const match = callOfRow({ row, calls: options.calls });

  if (!match) return of(undefined);

  return transcriptBetween$({ ports: options.ports, from: row.from, to: row.to }).pipe(
    map((chunks) => callTranscriptExcerpt({ chunks, call: match.call, window: row })),
  );
};
