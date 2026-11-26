import { computed, DestroyRef, Signal, signal, untracked } from '@angular/core';
import { filter, map, mergeMap, Observable, share, Subject, take } from 'rxjs';
import { HttpRequestLoadingState } from './http-request';
import { injectInQueryContext } from './internal/inject-in-query-context';
import { AnyNewQuery, Query, ResponseType } from './query';
import { QueryErrorResponse } from './query-error-response';
import { RunQueryExecuteOptions } from './query-execute-utils';

/** The fixed members of a query group, keyed by the name the group reports them under. */
export type QueryGroupMembers = Record<string, AnyNewQuery>;

type QueryGroupMemberResponse<TQuery> = TQuery extends Query<infer TArgs> ? ResponseType<TArgs> : never;

type QueryGroupKey<TMembers extends QueryGroupMembers> = keyof TMembers & string;

/** The member that ran last and its current response, which is `null` until it has one. */
export type QueryGroupLatest<TMembers extends QueryGroupMembers> = {
  [TKey in QueryGroupKey<TMembers>]: { key: TKey; response: QueryGroupMemberResponse<TMembers[TKey]> | null };
}[QueryGroupKey<TMembers>];

/** A settled, successful execution of one member. */
export type QueryGroupSuccess<TMembers extends QueryGroupMembers> = {
  [TKey in QueryGroupKey<TMembers>]: { key: TKey; response: QueryGroupMemberResponse<TMembers[TKey]> };
}[QueryGroupKey<TMembers>];

/**
 * A fixed set of queries of which the one executed last wins - an action set like accept/decline or
 * create/edit/delete. Built by {@link createQueryGroup}.
 */
export type QueryGroup<TMembers extends QueryGroupMembers> = {
  /** The members. Executing one through here records it as {@link QueryGroup.latest}; executing the query you passed in does not. */
  members: TMembers;

  /** The loading state of a member that is loading, the latest one first. `null` when none is. */
  loading: Signal<HttpRequestLoadingState | null>;

  /** The error of the latest member only, so an older member's failure clears once another one runs. */
  error: Signal<QueryErrorResponse | null>;

  /** The member executed last, or `null` before the first execution. */
  latest: Signal<QueryGroupLatest<TMembers> | null>;

  /** Re-runs the latest member with its last args. Does nothing before the first execution. */
  execute: (executeArgs?: { options?: RunQueryExecuteOptions }) => void;

  /** Emits once for every member execution through the group that succeeds. Completes when the group's injection context is destroyed. */
  succeeded$: Observable<QueryGroupSuccess<TMembers>>;
};

export type AnyQueryGroup = QueryGroup<QueryGroupMembers>;

type QueryGroupMember = { key: string; query: AnyNewQuery; execute: AnyNewQuery['execute'] };

/**
 * Groups a fixed set of queries of which the one executed last wins. The group fits `etQueryButton` and
 * `et-query-error`'s `[query]`, which retries the member that ran last. Call it in an injection context.
 *
 * @example
 * readonly actions = createQueryGroup({
 *   accept: postAcceptInvitation(withArgs(() => ({ pathParams: { id: this.id() } }))),
 *   decline: postDeclineInvitation(withArgs(() => ({ pathParams: { id: this.id() } }))),
 * });
 *
 * accept() {
 *   this.actions.members.accept.execute();
 * }
 */
export const createQueryGroup = <TMembers extends QueryGroupMembers>(members: TMembers): QueryGroup<TMembers> => {
  const executions = new Subject<QueryGroupMember>();
  const latestMember = signal<QueryGroupMember | null>(null);

  injectInQueryContext(DestroyRef, 'query group').onDestroy(() => executions.complete());

  const wrap = (key: string, query: AnyNewQuery): AnyNewQuery => {
    const member: QueryGroupMember = {
      key,
      query,
      execute: (executeArgs) => {
        const ran: unknown = query.execute(executeArgs);

        if (ran === false) return false;

        latestMember.set(member);
        executions.next(member);

        return true;
      },
    };

    return { ...query, execute: member.execute };
  };

  const wrappedMembers = Object.fromEntries(
    Object.entries(members).map(([key, query]) => [key, wrap(key, query)]),
  ) as TMembers;

  const queries = Object.values(members);

  const loading = computed(
    () =>
      latestMember()?.query.loading() ??
      queries.map((query) => query.loading()).find((state) => state !== null) ??
      null,
  );

  const error = computed(() => latestMember()?.query.error() ?? null);

  const latest = computed(() => {
    const member = latestMember();

    return member ? ({ key: member.key, response: member.query.response() } as QueryGroupLatest<TMembers>) : null;
  });

  const execute = (executeArgs?: { options?: RunQueryExecuteOptions }) => untracked(latestMember)?.execute(executeArgs);

  const succeeded$ = executions.pipe(
    mergeMap(({ key, query }) => {
      const snapshot = query.createSnapshot();

      return snapshot.isAlive.asObservable().pipe(
        filter((isAlive) => !isAlive),
        take(1),
        map(() => untracked(() => snapshot.executionState())),
        filter((state) => state?.type === 'success'),
        map((state) => ({ key, response: state.response }) as QueryGroupSuccess<TMembers>),
      );
    }),
    share(),
  );

  return { members: wrappedMembers, loading, error, latest, execute, succeeded$ };
};
