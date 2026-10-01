import { DestroyRef, Directive, Signal, booleanAttribute, computed, inject, input } from '@angular/core';
import { ButtonDirective } from './button.directive';

export type QueryButtonLoadingState = { progress?: { percentage?: number } | null } | boolean | null;

/**
 * What `etQueryButton` observes. A `Query`, a paged query stack and {@link queryButtonSourceFromV2Query}
 * fit the `loading` shape; a `QueryBatch` and a `QuerySequence` fit the `running` shape.
 */
export type QueryButtonSource =
  { loading: Signal<QueryButtonLoadingState> } | { running: Signal<boolean>; progress: Signal<number> };

type QueryButtonState = { loading: boolean; progress: number | null };

const IDLE_STATE: QueryButtonState = { loading: false, progress: null };

const readQueryButtonSource = (source: QueryButtonSource | null): QueryButtonState => {
  if (!source) return IDLE_STATE;

  if ('loading' in source) {
    const loading = source.loading();

    if (!loading) return IDLE_STATE;

    return { loading: true, progress: loading === true ? null : (loading.progress?.percentage ?? null) };
  }

  return source.running() ? { loading: true, progress: source.progress() } : IDLE_STATE;
};

/**
 * Puts the host button into its loading state while a query runs, and shows the query's progress on
 * the spinner. It only observes: run the query from your own `(click)` handler or form submit.
 *
 * @example
 * <button [etQueryButton]="deletePost" (click)="delete()" et-button>Delete</button>
 */
@Directive({
  selector: '[etQueryButton]',
  exportAs: 'etQueryButton',
})
export class QueryButtonDirective {
  private button = inject(ButtonDirective);

  /** The query to observe. `null` leaves the button idle. */
  public query = input.required<QueryButtonSource | null>({ alias: 'etQueryButton' });

  /** Whether the spinner shows the query's progress percentage when it reports one. */
  public showProgress = input(true, { transform: booleanAttribute });

  private state = computed(() => readQueryButtonSource(this.query()));

  public loading = computed(() => this.state().loading);

  public progress = computed(() => (this.showProgress() ? this.state().progress : null));

  constructor() {
    const source = { loading: this.loading, progress: this.progress };

    this.button.registerLoadingSource(source);
    inject(DestroyRef).onDestroy(() => this.button.unregisterLoadingSource(source));
  }
}
