import { EMPTY, Observable, concatMap, expand, from, last, map, of, toArray } from 'rxjs';
import { AgentUsageEvent } from '../model/event';
import { AgentSessionCursor } from './collect';
import { AgentSessionLogParseOptions, AgentSessionLogParser } from './source';
import { AgentSessionLogReader, AgentSessionLogRef } from './ports';

/** How many logs one run reads to their end. Small, because a run parses every line of each of them. */
export const DEFAULT_SPEND_BACKFILL_LOGS_PER_RUN = 5;

/**
 * The reads one log may take in one run. A read that returns lines always advances the offset, so this
 * only stops a log the host keeps replacing under the cursor from holding a run open for ever.
 */
const MAX_READS_PER_LOG = 200;

export type AgentSpendBackfill = {
  /** Every turn's spend the run found. Keyed by provider and turn id, so appending it twice is free. */
  usage: AgentUsageEvent[];
  /** The cursors to persist, for the logs this run read to their end. Logs it did not reach get none. */
  cursors: AgentSessionCursor[];
  /** Logs still without a cursor after this run. Zero means the pass has converged and can stop. */
  remaining: number;
  unparsedLines: number;
};

type LogBackfill = {
  usage: AgentUsageEvent[];
  unparsedLines: number;
  nextLine: number;
  reachedEnd: boolean;
  reads: number;
};

/**
 * Reads one log from `fromLine` to its end, in as many host reads as that takes.
 *
 * The host caps a read at a fixed number of lines, so one read does not reach the end of a long log.
 * The whole log has to be read inside one run, because the pass marks a log it read as done.
 */
const readToEnd$ = (options: {
  parser: AgentSessionLogParser;
  parsing?: Omit<AgentSessionLogParseOptions, 'lines' | 'resume'>;
  reader: AgentSessionLogReader;
  ref: AgentSessionLogRef;
  fromLine: number;
}): Observable<LogBackfill> =>
  of<LogBackfill>({
    usage: [],
    unparsedLines: 0,
    nextLine: options.fromLine,
    reachedEnd: false,
    reads: 0,
  }).pipe(
    expand((seen) =>
      seen.reachedEnd || seen.reads >= MAX_READS_PER_LOG
        ? EMPTY
        : options.reader.readLines$({ ref: options.ref, fromLine: seen.nextLine }).pipe(
            map((chunk): LogBackfill => {
              const parsed = options.parser({ ...options.parsing, lines: chunk.lines });

              return {
                usage: [...seen.usage, ...parsed.usage],
                unparsedLines: seen.unparsedLines + parsed.unparsedLines,
                nextLine: chunk.nextLine,
                reachedEnd: !chunk.lines.length,
                reads: seen.reads + 1,
              };
            }),
          ),
    ),
    last(),
  );

/**
 * Reads the spend out of agent session logs the collector had already read past, and hands back the
 * cursors the host has to persist.
 *
 * Spend collection started after months of logs had been read, so the stored days hold none. This
 * reads each log from the top and keeps only the token counts — it never touches the collector's own
 * cursor, because an activity sample has no dedupe key and a re-read would append every one of them a
 * second time. See ADR 0003.
 *
 * The pass converges: a log read to its end is never read again, and everything the log gains after
 * that is the collector's to store. A run reads `logsPerRun` logs, so a machine with hundreds of them
 * fills in over several runs rather than in one that blocks the application.
 */
export const backfillAgentSpend$ = (options: {
  parser: AgentSessionLogParser;
  reader: AgentSessionLogReader;
  /** The `spend` cursors, never the collector's. A log one of them reports read through is skipped. */
  cursors: readonly AgentSessionCursor[];
  /** Defaults to `DEFAULT_SPEND_BACKFILL_LOGS_PER_RUN`. */
  logsPerRun?: number;
  parsing?: Omit<AgentSessionLogParseOptions, 'lines' | 'resume'>;
}): Observable<AgentSpendBackfill> => {
  const done = new Map(options.cursors.map((cursor) => [cursor.id, cursor]));
  const perRun = options.logsPerRun ?? DEFAULT_SPEND_BACKFILL_LOGS_PER_RUN;

  return options.reader.logs$({}).pipe(
    concatMap((refs) => {
      // A cursor a re-sync rewound has no `readThrough` any more, so the log is read again — which is
      // how a new project link recovers the spend dropped while nothing covered its checkout.
      const pending = refs.filter((ref) => !done.get(ref.id)?.readThrough);
      const taken = pending.slice(0, perRun);

      return from(taken).pipe(
        concatMap((ref) =>
          readToEnd$({
            parser: options.parser,
            parsing: options.parsing,
            reader: options.reader,
            ref,
            fromLine: 0,
          }).pipe(map((read) => ({ ref, read }))),
        ),
        toArray(),
        map((reads): AgentSpendBackfill => {
          const finished = reads.filter((entry) => entry.read.reachedEnd);

          return {
            usage: reads.flatMap((entry) => entry.read.usage).sort((a, b) => a.at.getTime() - b.at.getTime()),
            cursors: finished.map((entry) => ({
              id: entry.ref.id,
              nextLine: entry.read.nextLine,
              readThrough: entry.ref.modifiedAt,
              ...(entry.read.usage.length ? { cwd: entry.read.usage[entry.read.usage.length - 1]?.cwd } : {}),
            })),
            remaining: pending.length - finished.length,
            unparsedLines: reads.reduce((total, entry) => total + entry.read.unparsedLines, 0),
          };
        }),
      );
    }),
  );
};
