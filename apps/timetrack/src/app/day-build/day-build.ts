import { DayRows, StreamDay, buildRows, streamDay } from '@ethlete/timetrack';

export type DayBuildRequest =
  { kind: 'stream'; input: Parameters<typeof streamDay>[0] } | { kind: 'rows'; input: Parameters<typeof buildRows>[0] };

export type DayBuildMessage = { id: number; request: DayBuildRequest };

export type DayBuildReply = { id: number; result: StreamDay | DayRows } | { id: number; error: string };

/** Runs one day build. The day build worker calls it; the page only when that worker failed to load. */
export const runDayBuild = (request: DayBuildRequest): StreamDay | DayRows =>
  request.kind === 'stream' ? streamDay(request.input) : buildRows(request.input);

export const replyTo = ({ id, request }: DayBuildMessage): DayBuildReply => {
  try {
    return { id, result: runDayBuild(request) };
  } catch (error) {
    return { id, error: error instanceof Error ? (error.stack ?? error.message) : String(error) };
  }
};
