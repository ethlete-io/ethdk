import { HttpEventType } from '@angular/common/http';
import { queryDevtoolsFnDetail } from '../devtools/query-devtools-features';
import { HttpRequest } from './http-request';
import { QueryArgs, RawResponseType, RequestArgs, ResponseType } from './query';
import { QueryCreator } from './query-creator';
import { QueryDependencies } from './query-dependencies';
import { withOptimisticUpdateUsedOnRead } from './query-errors';
import { createQueryFeature, QueryFeature, QueryFeatureType } from './query-features';
import { createQueryInvalidationFilter, QueryInvalidationTarget, resolveInvalidationUrl } from './query-invalidation';

/** What {@link WithOptimisticUpdateOptions.update} is handed. */
export type OptimisticUpdateContext<TArgs extends QueryArgs, TCurrent> = {
  /** The cached response of the read being updated, as the server sent it (before its `transformResponse`). */
  current: TCurrent;

  /** The args the mutation is sent with. */
  args: RequestArgs<TArgs>;

  /**
   * `undefined` before the request. After a successful one, the mutation's response, or `null` for an empty
   * one (a `204`).
   */
  response?: ResponseType<TArgs> | null;
};

type OptimisticCurrent<TRead extends QueryArgs> = [TRead] extends [never] ? unknown : RawResponseType<TRead>;

/** @see withOptimisticUpdate */
export type WithOptimisticUpdateOptions<TArgs extends QueryArgs, TRead extends QueryArgs = never> = {
  /**
   * The read creator whose entries `target` matches. Only types `current`; the entries are found by `target`
   * alone, so it must not match entries of another read. Without it, `current` is `unknown`.
   */
  read?: QueryCreator<TRead>;

  /** The cache entries to update: every read below a URL, or every read that declared a tag. */
  target: (context: { args: RequestArgs<TArgs> }) => QueryInvalidationTarget | readonly QueryInvalidationTarget[];

  /**
   * Returns the next response of one matched entry, or `null` to leave it alone. Called before the request,
   * again with `response` after a successful one (`null` there keeps the earlier result), and again whenever
   * another optimistic update of the same entry rolls back. Must be pure.
   */
  update: (context: OptimisticUpdateContext<TArgs, OptimisticCurrent<TRead>>) => OptimisticCurrent<TRead> | null;
};

type OptimisticOp = {
  apply: (current: unknown) => unknown;
  settled: boolean;
};

type OptimisticLayer = {
  base: unknown;
  written: unknown;
  ops: OptimisticOp[];
};

const optimisticLayers = /* @__PURE__ */ new WeakMap<HttpRequest<QueryArgs>, OptimisticLayer>();

const liveLayer = (request: HttpRequest<QueryArgs>) => {
  const layer = optimisticLayers.get(request);

  if (layer && layer.written === request.response()) return layer;

  optimisticLayers.delete(request);

  return null;
};

const rewrite = (request: HttpRequest<QueryArgs>, layer: OptimisticLayer) => {
  layer.written = layer.ops.reduce((current, op) => op.apply(current) ?? current, layer.base);
  request.subtle.setResponse(layer.written);

  if (layer.ops.every((op) => op.settled)) optimisticLayers.delete(request);
};

const applyOp = (request: HttpRequest<QueryArgs>, op: OptimisticOp) => {
  const current = request.response();

  if (current === null) return false;

  const layer: OptimisticLayer = liveLayer(request) ?? { base: current, written: current, ops: [] };
  const next = op.apply(layer.written);

  if (next === null) return false;

  layer.ops.push(op);
  layer.written = next;
  optimisticLayers.set(request, layer);
  request.subtle.setResponse(next);

  return true;
};

const settleOp = (request: HttpRequest<QueryArgs>, op: OptimisticOp, confirmed: OptimisticOp['apply'] | null) => {
  const layer = liveLayer(request);
  const index = layer?.ops.indexOf(op) ?? -1;

  if (!layer || index === -1) return;

  if (confirmed) {
    op.apply = confirmed;
    op.settled = true;
  } else {
    layer.ops.splice(index, 1);
  }

  rewrite(request, layer);
};

const findTargetRequests = (deps: QueryDependencies, targets: readonly QueryInvalidationTarget[]) => {
  const filters = targets.map((target) =>
    createQueryInvalidationFilter(
      'url' in target
        ? { url: resolveInvalidationUrl(deps.client.baseUrl, target.url) }
        : { url: null, tag: target.tag },
    ),
  );

  return deps.client.repository.subtle
    .cacheEntries()
    .filter((entry) => entry.isRefreshable && filters.some((filter) => filter?.(entry.request, entry.tags)))
    .map((entry) => entry.request);
};

/**
 * Writes the expected result of a mutation into the cached responses of the reads `target` matches before
 * the request leaves, and rolls those writes back if it fails or is cancelled. Pair it with the creator's
 * `invalidates`, whose refetch corrects a wrong guess. The writes stay in this tab; the invalidation reaches
 * the others.
 *
 * A rollback leaves an entry alone that a refetch or another tab wrote in the meantime; other optimistic
 * updates of the entry still pending are re-applied on top of what it held before.
 *
 * @example
 * patchOpportunityPerson(
 *   withArgs(() => ({ pathParams: { uuid, peopleUuid }, body })),
 *   withOptimisticUpdate({
 *     read: getOpportunity,
 *     target: ({ args }) => ({ tag: `opportunity:${args.pathParams.uuid}` }),
 *     update: ({ current, args }) => ({ ...current, people: toggle(current.people, args.pathParams.peopleUuid) }),
 *   }),
 * );
 *
 * @throws If the query is a read (e.g. a GET request)
 */
export const withOptimisticUpdate = <TArgs extends QueryArgs, TRead extends QueryArgs = never>(
  options: WithOptimisticUpdateOptions<TArgs, TRead>,
): QueryFeature<TArgs> => {
  const update = options.update as (context: OptimisticUpdateContext<TArgs, unknown>) => unknown;

  return createQueryFeature<TArgs>({
    type: QueryFeatureType.WITH_OPTIMISTIC_UPDATE,
    devtools: () => queryDevtoolsFnDetail(options.update, 'update'),
    fn: (context) => {
      if (context.flags.shouldAutoExecuteMethod) throw withOptimisticUpdateUsedOnRead(context.flags.method);

      context.state.subtle.beforeExecute.set((executeArgs) => {
        const args = executeArgs ?? ({} as RequestArgs<TArgs>);
        const target = options.target({ args });
        const targets = Array.isArray(target) ? target : [target as QueryInvalidationTarget];
        const optimistic = (current: unknown) => update({ current, args });

        const applied = findTargetRequests(context.deps, targets)
          .map((request) => ({ request, op: { apply: optimistic, settled: false } }))
          .filter(({ request, op }) => applyOp(request, op));

        if (!applied.length) return null;

        const settle = (confirmed: OptimisticOp['apply'] | null) => {
          for (const { request, op } of applied) settleOp(request, op, confirmed);
        };

        return (request) => {
          if (!request?.loading()) return settle(null);

          let settled = false;

          const subscription = request.events$.subscribe({
            next: (event) => {
              if (event.type === HttpEventType.Response) {
                const response = context.state.subtle.request() === request ? context.state.response() : null;

                settled = true;
                settle((current) => update({ current, args, response }) ?? optimistic(current));
              } else if (event.type === 'error' || event.type === 'cancel') {
                settled = true;
                settle(null);
              }

              if (settled) subscription.unsubscribe();
            },
            complete: () => {
              if (!settled) settle(null);
            },
          });
        };
      });
    },
  });
};
