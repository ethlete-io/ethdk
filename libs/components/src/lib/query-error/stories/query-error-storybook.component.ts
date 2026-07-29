import { HttpErrorResponse } from '@angular/common/http';
import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { ProvideSurfaceDirective, injectLocale } from '@ethlete/core';
import { createQueryErrorResponse } from '@ethlete/query';
import { BUTTON_IMPORTS } from '../../button';
import { QUERY_ERROR_IMPORTS } from '../query-error.imports';

/** The shapes an API actually answers with — each one a different branch of the client's normalizer. */
const ERROR_BODIES = {
  message: { status: 403, body: { message: 'You do not have access to this team.' } },
  violations: {
    status: 422,
    body: {
      violations: [
        { message: 'A name is required.' },
        { message: 'The email address is not valid.' },
        { message: 'The start date must be before the end date.' },
      ],
    },
  },
  classValidator: { status: 400, body: { message: ['name should not be empty', 'email must be an email'] } },
  retryable: { status: 503, body: { message: 'The service is briefly unavailable.' } },
  empty: { status: 500, body: null },
  echoesTitle: { status: 404, body: { message: 'Not found' } },
} as const;

export type QueryErrorStoryShape = keyof typeof ERROR_BODIES;

@Component({
  selector: 'et-sb-query-error',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-6 p-8 font-sans">
      <div class="flex flex-wrap items-center gap-3">
        <button (click)="cycleLocale()" etButton size="xs" variant="transparent">
          Locale: {{ locale.currentLocale() }}
        </button>
        <span class="text-small opacity-60">
          Status {{ selected().status }} · retryable: {{ error()?.retryState.retry ? 'yes' : 'no' }}
        </span>
      </div>

      @if (error(); as err) {
        <et-query-error
          [error]="err"
          [query]="query"
          [alwaysAllowRetry]="alwaysAllowRetry()"
          [style.max-inline-size.px]="520"
        />
      }

      @if (withSlots()) {
        <et-query-error [error]="error()" [query]="query" [style.max-inline-size.px]="520">
          <ng-template etQueryErrorTitle let-error>
            {{ error.status === 403 ? 'This team is private' : error.title }}
          </ng-template>

          <ng-template etQueryErrorActions>
            <button (click)="retries.set(retries() + 1)" etButton size="sm">Try again</button>
            <a class="text-small underline" href="#">Contact support</a>
          </ng-template>
        </et-query-error>
      }

      <p class="text-small opacity-60">Retries triggered: {{ retries() }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [QUERY_ERROR_IMPORTS, BUTTON_IMPORTS, ProvideSurfaceDirective],
})
export class QueryErrorStorybookComponent {
  protected locale = injectLocale();
  public surface = input('dark');
  public shape = input<QueryErrorStoryShape>('message');
  public alwaysAllowRetry = input(false);

  /** Renders a second copy with both slots replaced, so the customization story is side by side. */
  public withSlots = input(false);
  protected retries = signal(0);

  /** Stands in for a query: the component only needs something with `execute`. */
  protected query = { execute: () => this.retries.update((count) => count + 1) };

  protected selected = computed(() => ERROR_BODIES[this.shape()]);

  protected error = computed(() => {
    const { status, body } = this.selected();

    return createQueryErrorResponse(
      new HttpErrorResponse({ error: body, status, statusText: 'Error', url: '/api/teams/42' }),
    );
  });

  protected cycleLocale() {
    this.locale.currentLocale.update((current) => (current.startsWith('de') ? 'en' : 'de'));
  }
}
