import { Observable, concatMap, from, map, of, reduce } from 'rxjs';
import { TimetrackProjectLink, matchProjectLink } from '../model/project-link';
import { TimetrackExclusionRule, titleRuleDenial } from '../store/exclusion';
import { redactTitleUrls } from '../store/title';
import { AgentSessionCursor } from './collect';
import { AgentLogPass } from './ports';

/** The progress state alone: where the next read starts, and nothing about what the log said. */
const progressOnly = (cursor: AgentSessionCursor): AgentSessionCursor => ({
  id: cursor.id,
  nextLine: cursor.nextLine,
  ...(cursor.after ? { after: cursor.after } : {}),
  ...(cursor.readThrough ? { readThrough: cursor.readThrough } : {}),
});

const withoutTitle = (cursor: AgentSessionCursor): AgentSessionCursor => {
  const { title, ...rest } = cursor;

  return rest;
};

/**
 * Every cursor with what the user denied removed from it. A cursor comes back as the same object when
 * it holds nothing denied, which is what lets a repair pass write only the rows it changed.
 *
 * A cursor carries the log's last title, its checkout and its session state so that the next read can
 * resume mid-session. The events of that log go through the project links and the exclusion rules
 * before the store, and this puts the cursor under the same two rules — without it a title a rule
 * denied, and the path of a checkout the user marked private, are both written to the database anyway.
 *
 * What a sanitized cursor loses is only what the denied events would have carried: a private
 * checkout's later samples are dropped whichever title or model the cursor remembered, and a log whose
 * title a rule denies has no sample to resume for. The line offset always stays, so no log is read
 * twice.
 */
export const sanitizeAgentSessionCursors = (options: {
  cursors: readonly AgentSessionCursor[];
  links: readonly TimetrackProjectLink[];
  rules: readonly TimetrackExclusionRule[];
}): AgentSessionCursor[] => {
  const denial = titleRuleDenial(options.rules);

  return options.cursors.map((cursor) => {
    for (const path of [cursor.cwd, cursor.session?.workedIn]) {
      if (!path) continue;

      const target = matchProjectLink({ context: { repoPath: path }, links: options.links })?.target;

      if (target?.kind === 'private' || denial(path)) return progressOnly(cursor);
    }

    const title = cursor.title;

    if (title === undefined) return cursor;
    if (denial(title)) return withoutTitle(cursor);

    const redacted = redactTitleUrls(title);

    return redacted === title ? cursor : { ...cursor, title: redacted };
  });
};

/**
 * The cursor half of `TimetrackEventStore`, for the repair pass alone. A cursor is written by the
 * collector that moved it and by nothing else.
 */
export type TimetrackCursorRepairStore = {
  cursors$(pass: AgentLogPass): Observable<AgentSessionCursor[]>;
  /** Writes each cursor over the stored one of the same id and pass, clearing the fields it drops. */
  writeCursors$(options: { pass: AgentLogPass; cursors: readonly AgentSessionCursor[] }): Observable<unknown>;
};

/** What one cursor repair pass read and what it had to change. */
export type CursorRepairReport = { scanned: number; rewritten: number };

/**
 * Applies `sanitizeAgentSessionCursors` to every cursor already in the store, one pass at a time, and
 * reports what it read and rewrote. Run it after a link turns private or a rule is added: the rules
 * run on the way in, so a cursor written before them holds what they now deny.
 *
 * Running it twice is free — a cursor it already cleaned comes back unchanged and is not written.
 */
export const repairStoredCursors$ = (options: {
  store: TimetrackCursorRepairStore;
  passes: readonly AgentLogPass[];
  links: readonly TimetrackProjectLink[];
  rules: readonly TimetrackExclusionRule[];
}): Observable<CursorRepairReport> =>
  from(options.passes).pipe(
    concatMap((pass) =>
      options.store.cursors$(pass).pipe(
        concatMap((cursors) => {
          const sanitized = sanitizeAgentSessionCursors({ cursors, links: options.links, rules: options.rules });
          const changed = sanitized.filter((cursor, index) => cursor !== cursors[index]);
          const report: CursorRepairReport = { scanned: cursors.length, rewritten: changed.length };

          if (!changed.length) return of(report);

          return options.store.writeCursors$({ pass, cursors: changed }).pipe(map(() => report));
        }),
      ),
    ),
    reduce(
      (all, report): CursorRepairReport => ({
        scanned: all.scanned + report.scanned,
        rewritten: all.rewritten + report.rewritten,
      }),
      { scanned: 0, rewritten: 0 },
    ),
  );
