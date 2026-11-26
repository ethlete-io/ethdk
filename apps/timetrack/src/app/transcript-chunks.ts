import { HeardChunk, MIDNIGHT, localDayKey } from '@ethlete/timetrack';
import { Observable, catchError, combineLatest, map, of } from 'rxjs';
import { HostPorts, TranscriptChunk } from '../host';

const calendarDaysOf = (from: Date, to: Date) => [
  ...new Set([localDayKey(from, MIDNIGHT), localDayKey(new Date(to.getTime() - 1), MIDNIGHT)]),
];

export const transcriptBetween$ = (options: {
  ports: HostPorts;
  from: Date;
  to: Date;
}): Observable<TranscriptChunk[]> => {
  const { ports, from, to } = options;

  return combineLatest(
    calendarDaysOf(from, to).map((day) => ports.transcription.day$(day).pipe(catchError(() => of([])))),
  ).pipe(map((days) => days.flat().filter((chunk) => chunk.atMs >= from.getTime() && chunk.atMs < to.getTime())));
};

export const heardChunksOf = (chunks: readonly TranscriptChunk[]): HeardChunk[] =>
  chunks.map(({ atMs, appId }) => ({ atMs, appId }));
