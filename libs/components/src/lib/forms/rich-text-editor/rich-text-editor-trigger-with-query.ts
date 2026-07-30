import { Signal, signal } from '@angular/core';
import {
  AnyQueryCreator,
  QueryArgsOf,
  QueryErrorResponse,
  QueryExecutionState,
  RequestArgs,
  ResponseType,
  withArgs,
} from '@ethlete/query';
import { filter, map, take } from 'rxjs';
import {
  createRichTextEditorTrigger,
  RichTextEditorTrigger,
  RichTextEditorTriggerItem,
  RichTextEditorTriggerItemResolver,
} from './rich-text-editor-trigger';

// Note: `@ethlete/components` intentionally depends on `@ethlete/query` (the legacy `cdk` does too),
// so this query-aware convenience factory can live here. It is a standalone function in its own
// module — editors that don't use it (and apps not using `@ethlete/query`) tree-shake it away.

/** Config for {@link createRichTextEditorTriggerWithQuery}. */
export type RichTextEditorQueryTriggerConfig<TCreator extends AnyQueryCreator> = {
  /** The character that opens the popup at a word boundary (e.g. `'@'`). */
  char: string;
  /** Namespaces the inserted token (`{{type:id}}`). Unique per editor; matches `[a-z][a-z0-9-]*`. */
  type: string;
  /**
   * The query creator to run (e.g. from `createGetQuery`). Like a query stack, the query is created
   * **once** and re-executes reactively — never per keystroke.
   */
  queryCreator: TCreator;
  /**
   * Builds the request args from the current query text. Runs reactively (like `withArgs`): reading
   * `search()` re-executes the query as the user types. Return `null` to skip a request (e.g. for an
   * empty query) so the popup shows no results without hitting the backend.
   */
  args: (search: Signal<string>) => RequestArgs<QueryArgsOf<TCreator>> | null;
  /** Maps a successful query response to popup items. */
  toItems: (response: ResponseType<QueryArgsOf<TCreator>>) => RichTextEditorTriggerItem[];
  /** Resolves a stored token id to a chip label (see the generic factory's `resolveItem`). */
  resolveItem?: RichTextEditorTriggerItemResolver;
  /** Turns a query failure into the popup's error text. Defaults to the first error message. */
  toErrorMessage?: (error: QueryErrorResponse) => string;
  /** Keep the popup open when the query contains spaces. @default false */
  allowSpaces?: boolean;
  /** Minimum query length before items are requested. @default 0 */
  minQueryLength?: number;
  /** Debounce applied before the query text is written and results are read, in ms. @default 150 */
  debounceTime?: number;
};

const firstErrorMessage = (error: QueryErrorResponse) => {
  const message = 'errors' in error ? error.errors[0]?.message : error.error?.message;

  return message ?? error.raw?.statusText ?? 'Something went wrong';
};

/**
 * A query-aware wrapper around {@link createRichTextEditorTrigger} that removes the manual wiring.
 * Mirroring `createQueryStack`, it takes the `queryCreator` plus a reactive `args` builder: the
 * query is created once and re-executes as the user types (the factory owns the search signal and
 * the `withArgs` feature). It maps the response to items and surfaces a query failure as the popup's
 * error state.
 *
 * Call it from a field initializer / constructor (injection context), the same place you'd create a
 * query or a query stack.
 *
 * ```ts
 * createRichTextEditorTriggerWithQuery({
 *   char: '@',
 *   type: 'mention',
 *   queryCreator: searchUsers,
 *   args: (search) => (search() ? { queryParams: { q: search() } } : null),
 *   toItems: (res) => res.items.map((u) => ({ id: u.id, label: u.name })),
 *   resolveItem: (id) => userById(id),
 * })
 * ```
 */
export const createRichTextEditorTriggerWithQuery = <TCreator extends AnyQueryCreator>(
  config: RichTextEditorQueryTriggerConfig<TCreator>,
): RichTextEditorTrigger => {
  type TArgs = QueryArgsOf<TCreator>;

  const search = signal('');
  // Created once, exactly like a query stack — `withArgs` re-runs as `search` changes.
  const query = config.queryCreator(withArgs<TArgs>(() => config.args(search)));
  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  return createRichTextEditorTrigger({
    char: config.char,
    type: config.type,
    resolveItem: config.resolveItem,
    allowSpaces: config.allowSpaces,
    minQueryLength: config.minQueryLength,
    debounceTime: config.debounceTime,
    items: (text) => {
      search.set(text);

      // The signal write above re-executes the query; take the first settled state for this text.
      // A failure is thrown so the editor's async pipeline surfaces it as the popup's error.
      return query.executionState.asObservable().pipe(
        filter(
          (state): state is Exclude<QueryExecutionState<TArgs>, { type: 'loading' }> =>
            state !== null && state.type !== 'loading',
        ),
        take(1),
        map((state) => {
          // Deliberately a plain `Error`, not a coded `RuntimeError`: the triggers directive renders
          // `error.message` verbatim as the popup's `role="alert"` text, so a `ET25xx: ` prefix would
          // end up in front of the user.
          if (state.type === 'failure') throw new Error(toErrorMessage(state.error));

          return config.toItems(state.response);
        }),
      );
    },
  });
};
