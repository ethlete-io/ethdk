import { Component, ViewEncapsulation, WritableSignal, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Appointment, BUTTON_IMPORTS } from '@ethlete/components';
import { JiraStatusMove, JiraTransition } from '@ethlete/timetrack';
import {
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  exhaustMap,
  filter,
  map,
  merge,
  of,
  share,
  startWith,
  switchMap,
} from 'rxjs';
import { injectJiraCatalog } from '../../jira';
import { TimelineEntry } from './row-appointment';

type Read<T> =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; value: T } | { kind: 'failed'; message: string };

type MoveState =
  | { kind: 'idle' }
  | { kind: 'moving'; statusName: string }
  | { kind: 'moved'; issueKey: string; statusName: string }
  | { kind: 'failed'; message: string };

const IDLE = { kind: 'idle' } as const;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const read$ = <T>(source$: Observable<T>): Observable<Read<T>> =>
  source$.pipe(
    map((value): Read<T> => ({ kind: 'ready', value })),
    catchError((error: unknown) => of<Read<T>>({ kind: 'failed', message: messageOf(error) })),
    startWith<Read<T>>({ kind: 'loading' }),
  );

/** The Jira status of the issue the row names, and the moves its workflow offers now. */
@Component({
  selector: 'ethlete-edit-issue-status',
  template: `
    @if (issueKey(); as key) {
      <div [attr.data-issue-status]="key" class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-3">
          <span class="text-small">
            <span class="text-et-surface-muted">Status</span>
            @switch (status().kind) {
              @case ('loading') {
                <span data-status-name>Reading…</span>
              }
              @case ('ready') {
                <span class="font-medium" data-status-name>{{ statusName() }}</span>
              }
              @case ('failed') {
                <span data-status-name>unknown</span>
              }
            }
          </span>

          @if (moves().kind === 'idle' && status().kind === 'ready') {
            <button (click)="opens$.next(key)" et-text-button type="button">Change status</button>
          }
        </div>

        @switch (moves().kind) {
          @case ('loading') {
            <span class="text-small text-et-surface-muted">Reading the moves {{ key }} offers…</span>
          }
          @case ('ready') {
            <div class="flex flex-wrap gap-2" role="group" aria-label="Move to">
              @for (move of offered(); track move.id) {
                <button
                  [disabled]="moveState().kind === 'moving'"
                  (click)="moveTo(key, move)"
                  et-button
                  size="sm"
                  type="button"
                >
                  {{ move.toStatusName }}
                </button>
              } @empty {
                <span class="text-small text-et-surface-muted">The workflow offers no move from here.</span>
              }
            </div>
          }
        }

        @if (moveState().kind === 'moving') {
          <span class="text-small text-et-surface-muted">Moving…</span>
        }
        @if (failure(); as message) {
          <span class="text-small text-et-error" data-status-error role="alert">{{ message }}</span>
        }
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class EditIssueStatusComponent {
  private catalog = injectJiraCatalog();

  public draft = input.required<WritableSignal<Appointment<TimelineEntry>>>();

  protected issueKey = computed(() => this.draft()().title.trim().toUpperCase());

  private issueKey$ = toObservable(this.issueKey).pipe(distinctUntilChanged());
  public opens$ = new Subject<string>();
  private moves$ = new Subject<{ issueKey: string; statusName: string }>();

  private outcomes$ = this.moves$.pipe(
    exhaustMap((move) =>
      this.catalog.moveIssue$(move).pipe(
        map((result) => outcomeOf(move.issueKey, result)),
        catchError((error: unknown) => of<MoveState>({ kind: 'failed', message: messageOf(error) })),
        startWith<MoveState>({ kind: 'moving', statusName: move.statusName }),
      ),
    ),
    share(),
  );

  private moved$ = this.outcomes$.pipe(
    filter((outcome): outcome is Extract<MoveState, { kind: 'moved' }> => outcome.kind === 'moved'),
  );

  protected status = toSignal(
    this.issueKey$.pipe(
      switchMap((key) =>
        key
          ? merge(
              read$(this.catalog.readIssueStatus$(key)),
              this.moved$.pipe(
                filter((moved) => moved.issueKey === key),
                map((moved): Read<string> => ({ kind: 'ready', value: moved.statusName })),
              ),
            )
          : of<Read<string>>(IDLE),
      ),
    ),
    { initialValue: IDLE as Read<string> },
  );

  protected moves = toSignal(
    merge(
      this.issueKey$.pipe(map((): Read<JiraTransition[]> => IDLE)),
      this.moved$.pipe(map((): Read<JiraTransition[]> => IDLE)),
      this.opens$.pipe(switchMap((key) => read$(this.catalog.readIssueMoves$(key)))),
    ),
    { initialValue: IDLE as Read<JiraTransition[]> },
  );

  protected moveState = toSignal(
    merge(
      this.issueKey$.pipe(map((): MoveState => IDLE)),
      this.opens$.pipe(map((): MoveState => IDLE)),
      this.outcomes$,
    ),
    { initialValue: IDLE as MoveState },
  );

  protected statusName = computed(() => {
    const status = this.status();

    return status.kind === 'ready' ? status.value || 'unknown' : '';
  });

  protected offered = computed(() => {
    const moves = this.moves();

    return moves.kind === 'ready' ? moves.value : [];
  });

  protected failure = computed(() => {
    const status = this.status();
    const moves = this.moves();
    const move = this.moveState();

    if (move.kind === 'failed') return move.message;
    if (moves.kind === 'failed') return moves.message;

    return status.kind === 'failed' ? status.message : null;
  });

  protected moveTo(issueKey: string, move: JiraTransition) {
    this.moves$.next({ issueKey, statusName: move.toStatusName });
  }
}

const outcomeOf = (issueKey: string, move: JiraStatusMove): MoveState => {
  if (move.kind === 'moved') return { kind: 'moved', issueKey, statusName: move.statusName };
  if (move.kind === 'failed') return { kind: 'failed', message: move.message };

  return { kind: 'failed', message: `Jira no longer offers a move to ${move.statusName}.` };
};
