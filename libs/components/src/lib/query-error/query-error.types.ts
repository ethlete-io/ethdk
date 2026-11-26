/**
 * What the directive needs from a query in order to retry it: something executable. Both query clients satisfy
 * it - the current client's `Query` directly, and a legacy one through
 * [`legacyQueryErrorSource`](./query-error-legacy).
 *
 * Typed structurally rather than against `Query<TArgs>` so this component never has to name a client's types,
 * which is what kept cdk's version pinned to the legacy one.
 */
export type QueryErrorRetryTarget = {
  execute: (executeArgs?: { options?: { allowCache?: boolean } }) => unknown;
};

/** A query error, ready to render. */
export type QueryErrorView = {
  /** The heading - from the status code, since that is the one thing every error has. */
  title: string;
  /** Every message the response carried, or one derived from the status code when it carried none. */
  messages: string[];
  /** Whether to render the messages as a list. True for a violation list, i.e. more than one message. */
  isList: boolean;
  /** Whether the failure is one the retry policy considers worth repeating. */
  canRetry: boolean;
  /** How long the retry policy would wait, in ms. `0` when it wouldn't retry at all. */
  retryDelay: number;
  /** The HTTP status, or `0` for a failure that never reached a server. */
  status: number;
};
