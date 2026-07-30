import { Directive, TemplateRef, booleanAttribute, computed, input, output, signal } from '@angular/core';
import { injectLocale } from '@ethlete/core';
import { QueryErrorResponse, queryErrorMessages } from '@ethlete/query';
import { QueryErrorLabels, injectQueryErrorLabels, queryErrorLabelsForLocale } from '../query-error-labels';
import { QueryErrorRetryTarget, QueryErrorView } from '../query-error.types';
import { QueryErrorSlotContext } from './query-error-slots.directive';
import { QUERY_ERROR_TOKEN } from './query-error.tokens';

/** Loosely comparable text, for spotting a message that merely repeats its own title. */
const comparable = (text: string) => text.toLowerCase().replace(/\s/g, '').replace(/[.,]/g, '');

/**
 * Turns a failed query into something renderable: a title, the messages, and whether retrying is worth
 * offering. All state, no markup — `<et-query-error>` is this with the chrome on top.
 *
 * The classification work is not here, deliberately. `@ethlete/query` already normalizes every error shape it
 * knows (class-validator arrays, Symfony violation lists, a bare `{ message }`, a plain string) into
 * `QueryErrorResponse` before it reaches `query.error()`, and it attaches the retry policy's verdict as
 * `retryState`. cdk re-did all of that by hand against the legacy client; this reads what the client already
 * worked out, which is why it is client-agnostic.
 *
 * @example
 * @if (usersQuery.error(); as error) {
 *   <div etQueryError [error]="error" [query]="usersQuery">…</div>
 * }
 */
@Directive({
  selector: '[etQueryError]',
  exportAs: 'etQueryError',
  providers: [{ provide: QUERY_ERROR_TOKEN, useExisting: QueryErrorDirective }],
  host: {
    class: 'et-query-error',
    // An error that appears after the fact has to announce itself; a reader who has moved on from the button
    // they pressed would otherwise never learn it failed. `alert` is the assertive one, which is right here —
    // the request they asked for did not happen.
    role: 'alert',
    '[attr.data-status]': 'view()?.status',
    '[attr.data-list]': 'view()?.isList ? "" : null',
  },
})
export class QueryErrorDirective {
  private injectedLabels = injectQueryErrorLabels();
  private locale = injectLocale();

  /**
   * The failed query's error, i.e. `query.error()`. `null` renders nothing, so this can be bound
   * unconditionally.
   */
  public error = input.required<QueryErrorResponse | null>();

  /**
   * The query to re-run when the reader retries. Optional: without it the retry button still renders (when the
   * error is retryable) and only emits `retry`, which is the hook for a legacy query or any other recovery.
   */
  public query = input<QueryErrorRetryTarget | null>(null);

  /**
   * Show the retry button even for an error the retry policy considers final — a 404 will not fix itself, and
   * offering to try again invites the reader to waste their time. Turn it on for a query whose failure really
   * can be transient in a way the policy can't see. @default false
   */
  public alwaysAllowRetry = input(false, { transform: booleanAttribute });

  /** Per-instance label overrides, merged over the locale's set and any `provideQueryErrorLabels`. */
  public labels = input<Partial<QueryErrorLabels> | null>(null);

  /**
   * The reader asked to retry. Fires whether or not `query` is set, and after the query has been re-executed
   * when it is — so it doubles as "retried" for analytics.
   */
  public retryRequest = output<void>();

  /** @internal Set by `etQueryErrorTitle`; replaces the default heading. */
  public titleSlot = signal<TemplateRef<QueryErrorSlotContext> | null>(null);

  /** @internal Set by `etQueryErrorActions`; replaces the whole actions row. */
  public actionsSlot = signal<TemplateRef<QueryErrorSlotContext> | null>(null);

  /** The strings in effect: the locale's set, with the injected and per-instance overrides applied. */
  public resolvedLabels = computed<QueryErrorLabels>(() => ({
    ...queryErrorLabelsForLocale(this.locale.currentLocale()),
    ...this.injectedLabels,
    ...this.labels(),
  }));

  /** The error as something to render, or `null` when there is no error. */
  public view = computed<QueryErrorView | null>(() => {
    const error = this.error();

    if (!error) return null;

    const labels = this.resolvedLabels();
    const status = error.code;
    const title = labels.title(status);
    const statusMessage = `${labels.message(status)} (Code: ${status})`;
    const messages = queryErrorMessages(error);
    const [single] = messages;

    // Two cases where the response's own message is worse than the status table's sentence:
    //
    //  - It repeats the title. Plenty of APIs answer 404 with "Not found", and rendering that under the
    //    heading "Not found" tells the reader nothing twice.
    //  - It *is* Angular's `HttpErrorResponse.message`, which is what the query client falls back to when the
    //    body carried no message at all — "Http failure response for /api/users: 500 Internal Server Error" is
    //    developer text and must never reach a reader.
    const isUseless =
      messages.length === 1 && !!single && (comparable(single) === comparable(title) || single === error.raw.message);

    const resolved = isUseless || messages.length === 0 ? [statusMessage] : messages;

    return {
      title,
      messages: resolved,
      isList: resolved.length > 1,
      canRetry: this.alwaysAllowRetry() || error.retryState.retry,
      retryDelay: error.retryState.retry ? error.retryState.delay : 0,
      status,
    };
  });

  /** Whether to offer a retry — false when there is no error at all. */
  public canRetry = computed(() => this.view()?.canRetry ?? false);

  /**
   * Re-run the query and tell the world. Bypasses the cache: a retry exists because the last answer was
   * unusable, so serving it again from memory would make the button do nothing.
   */
  public retry() {
    this.query()?.execute({ options: { allowCache: false } });
    this.retryRequest.emit();
  }
}
