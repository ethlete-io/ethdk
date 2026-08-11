import { Observable, concatMap, from, map, toArray } from 'rxjs';
import { AgentSessionEvent } from '../model/event';
import { AgentSessionLogParseOptions, AgentSessionLogParser } from './source';
import { AgentSessionLogReader, AgentSessionLogRef } from './ports';

export type AgentSessionCursor = {
  /** The log this cursor belongs to — an `AgentSessionLogRef.id`. */
  id: string;
  nextLine: number;
  /**
   * The last sample taken from this log. The line offset alone would let a record the agent appended
   * out of order through twice, since a log is not written in timestamp order.
   */
  after?: Date;
  /** Title records are rewritten as a session grows, so a batch holding none keeps what the last one said. */
  title?: string;
};

export type AgentSessionCollection = {
  events: AgentSessionEvent[];
  /**
   * The cursors to persist, including the ones for logs this run did not list. Store them together with
   * the events: a cursor that goes missing re-reads its log from the top and appends every sample twice.
   */
  cursors: AgentSessionCursor[];
  /** Lines that were not JSON, across every log this run read. A growing count means a corrupt log. */
  unparsedLines: number;
};

type LogRead = {
  events: AgentSessionEvent[];
  cursor: AgentSessionCursor;
  unparsedLines: number;
};

const readLog$ = (options: {
  parser: AgentSessionLogParser;
  parsing?: Omit<AgentSessionLogParseOptions, 'lines' | 'resume'>;
  reader: AgentSessionLogReader;
  ref: AgentSessionLogRef;
  cursor?: AgentSessionCursor;
}): Observable<LogRead> => {
  const { cursor, ref } = options;

  return options.reader.readLines$({ ref, fromLine: cursor?.nextLine ?? 0 }).pipe(
    map((chunk) => {
      const parsed = options.parser({
        ...options.parsing,
        lines: chunk.lines,
        resume: cursor ? { after: cursor.after, title: cursor.title } : undefined,
      });

      return {
        events: parsed.events,
        unparsedLines: parsed.unparsedLines,
        cursor: {
          id: ref.id,
          nextLine: chunk.nextLine,
          after: parsed.events[parsed.events.length - 1]?.at ?? cursor?.after,
          title: parsed.title,
        },
      };
    }),
  );
};

/**
 * Reads what the agent appended to each of its session logs since the last run and turns it into
 * activity samples, handing back the cursors the host has to persist for the next one.
 *
 * Logs are read one after another rather than all at once — a machine that has been coding for months
 * has hundreds of them, and this runs on a timer against the user's own disk.
 */
export const collectAgentSessions$ = (options: {
  parser: AgentSessionLogParser;
  reader: AgentSessionLogReader;
  cursors: AgentSessionCursor[];
  /** Skips logs the agent has not touched since. Cursors of the skipped logs are kept as they were. */
  modifiedAfter?: Date;
  parsing?: Omit<AgentSessionLogParseOptions, 'lines' | 'resume'>;
}): Observable<AgentSessionCollection> => {
  const cursors = new Map(options.cursors.map((cursor) => [cursor.id, cursor]));

  return options.reader.logs$({ modifiedAfter: options.modifiedAfter }).pipe(
    concatMap((refs) =>
      from(refs).pipe(
        concatMap((ref) =>
          readLog$({
            parser: options.parser,
            parsing: options.parsing,
            reader: options.reader,
            ref,
            cursor: cursors.get(ref.id),
          }),
        ),
        toArray(),
      ),
    ),
    map((reads) => {
      for (const read of reads) cursors.set(read.cursor.id, read.cursor);

      return {
        events: reads.flatMap((read) => read.events).sort((a, b) => a.at.getTime() - b.at.getTime()),
        cursors: [...cursors.values()],
        unparsedLines: reads.reduce((total, read) => total + read.unparsedLines, 0),
      };
    }),
  );
};
