import { Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgentSessionCollection, collectAgentSessions$, parseClaudeCodeSessionLog } from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, defer, exhaustMap, finalize, map, switchMap, tap, timer } from 'rxjs';
import { injectHostPorts } from '../host';

export const AGENT_SESSION_POLL_INTERVAL_MS = 60_000;

export type AgentSessionCollectorRun = {
  at: Date;
  events: number;
  unparsedLines: number;
};

/**
 * Polls the agent's session logs and stores what they gained since the last run.
 *
 * A run reads the cursors, collects from every log the host lists, and writes the events and the moved
 * cursors back in one transaction. Ticks arriving while a run is in flight are dropped rather than
 * queued, so a first run over a machine's whole log history cannot stack up behind itself.
 */
@Injectable({ providedIn: 'root' })
export class AgentSessionCollector {
  private readonly _ports = injectHostPorts();
  private readonly _lastRun = signal<AgentSessionCollectorRun | null>(null);
  private readonly _failure = signal<string | null>(null);
  private readonly _isCollecting = signal(false);

  /** Only ever moved by a run that persisted, or a failed run would skip the logs it never read. */
  private _modifiedAfter: Date | undefined;

  readonly lastRun = this._lastRun.asReadonly();
  readonly failure = this._failure.asReadonly();
  readonly isCollecting = this._isCollecting.asReadonly();

  constructor() {
    timer(0, AGENT_SESSION_POLL_INTERVAL_MS)
      .pipe(
        exhaustMap(() => this._collect$()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private _collect$(): Observable<AgentSessionCollection> {
    return defer(() => {
      const startedAt = new Date();

      this._isCollecting.set(true);

      return this._ports.events.cursors$().pipe(
        switchMap((cursors) =>
          collectAgentSessions$({
            parser: parseClaudeCodeSessionLog,
            reader: this._ports.agentLogs,
            cursors,
            modifiedAfter: this._modifiedAfter,
          }),
        ),
        switchMap((collection) => this._persist$(collection, startedAt)),
        catchError((error: unknown) => {
          this._failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
        finalize(() => this._isCollecting.set(false)),
      );
    });
  }

  private _persist$(collection: AgentSessionCollection, startedAt: Date): Observable<AgentSessionCollection> {
    return this._ports.events.appendWithCursors$(collection.events, collection.cursors).pipe(
      map(() => collection),
      tap(() => {
        this._modifiedAfter = startedAt;
        this._failure.set(null);
        this._lastRun.set({
          at: startedAt,
          events: collection.events.length,
          unparsedLines: collection.unparsedLines,
        });
      }),
    );
  }
}
