import { Component, ViewEncapsulation, signal } from '@angular/core';
import { QUERY_ERROR_IMPORTS } from '@ethlete/components';
import { createExampleError } from './query-error.data';

@Component({
  selector: 'app-query-error-retryable-example',
  template: `
    <et-query-error [error]="error" [query]="query" class="example-query-error" />

    <p class="example-query-error-retries">Retries triggered: {{ retries() }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [QUERY_ERROR_IMPORTS],
  styles: `
    .example-query-error {
      max-inline-size: 520px;
    }

    .example-query-error-retries {
      opacity: 0.6;
    }
  `,
})
export class QueryErrorRetryableExampleComponent {
  protected retries = signal(0);

  protected query = { execute: () => this.retries.update((count) => count + 1) };

  protected readonly error = createExampleError(503, { message: 'The service is briefly unavailable.' });
}
