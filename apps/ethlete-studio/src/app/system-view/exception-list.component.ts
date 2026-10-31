import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { EMPTY, catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { ListedException, approveException$, listedExceptions$, openExceptionsOf } from '../../host/design-exceptions';
import { INVENTORY_APPROVER } from './inventory';

type Reading = { exceptions: ListedException[]; error: string | null };

const NONE: Reading = { exceptions: [], error: null };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

@Component({
  selector: 'ethlete-exception-list',
  template: `
    @if (open().length > 0) {
      <button
        [pressed]="expanded()"
        (click)="expanded.set(!expanded())"
        et-button
        type="button"
        variant="outline"
        color="surface"
        size="sm"
        title="Exceptions of this part that wait for your approval"
        data-exceptions-toggle
      >
        Exceptions {{ open().length }}
      </button>
      @if (expanded()) {
        <section
          class="absolute top-full right-0 mt-2 flex w-xl flex-col gap-3 rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-3 shadow-lg"
          data-exceptions
        >
          @if (error(); as message) {
            <p
              [etProvideColor]="errorTheme()"
              class="m-0 text-small text-(--et-theme-color-primary-solid)"
              data-exceptions-error
            >
              {{ message }}
            </p>
          }
          <ul class="m-0 flex list-none flex-col gap-3 p-0">
            @for (exception of open(); track exception.key) {
              <li [attr.data-exception]="exception.key" class="flex items-start gap-3 text-small">
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="font-mono break-all text-text">{{ exception.key.slice(part().length + 1) }}</span>
                  <span class="text-text-muted">{{ exception.reason }}</span>
                  <span class="text-text-muted" data-exception-state>
                    {{ exception.state === 'reopened' ? 'reopened - the part changed' : 'pending' }}
                  </span>
                </span>
                <button
                  [disabled]="busy() !== null"
                  (click)="approve(exception.key)"
                  et-button
                  type="button"
                  variant="filled"
                  size="sm"
                  data-exception-approve
                >
                  Approve
                </button>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ProvideColorDirective],
  host: { class: 'relative flex' },
})
export class ExceptionListComponent {
  private destroyRef = inject(DestroyRef);
  protected errorTheme = injectSemanticColorTheme('error');
  public port = input.required<number>();
  public product = input.required<string>();
  public part = input.required<string>();
  /** Lists the exceptions anew on each change. */
  public revision = input(0);

  public reading = toSignal(
    toObservable(computed(() => ({ port: this.port(), product: this.product(), revision: this.revision() }))).pipe(
      switchMap((address) =>
        listedExceptions$(address).pipe(
          map((exceptions): Reading => ({ exceptions, error: null })),
          catchError((error: unknown) => of<Reading>({ exceptions: [], error: messageOf(error) })),
        ),
      ),
    ),
    { initialValue: NONE },
  );

  private exceptions = linkedSignal(() => this.reading().exceptions);

  private approveError = linkedSignal<Reading, string | null>({ source: this.reading, computation: () => null });

  protected error = computed(() => this.approveError() ?? this.reading().error);

  protected open = computed(() => openExceptionsOf(this.exceptions(), this.part()));

  protected expanded = linkedSignal<string, boolean>({ source: this.part, computation: () => false });

  protected busy = signal<string | null>(null);

  protected approve(key: string) {
    if (this.busy() !== null) return;

    this.busy.set(key);
    this.approveError.set(null);
    approveException$({ port: this.port(), product: this.product() }, { key, by: INVENTORY_APPROVER })
      .pipe(
        tap((approved) =>
          this.exceptions.update((exceptions) =>
            exceptions.map((exception) =>
              exception.key === key ? { ...exception, state: 'approved', approval: approved.approval } : exception,
            ),
          ),
        ),
        catchError((error: unknown) => {
          this.approveError.set(messageOf(error));

          return EMPTY;
        }),
        finalize(() => this.busy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
