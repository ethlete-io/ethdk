import { Component, ViewEncapsulation } from '@angular/core';
import { QueryErrorComponent } from '@ethlete/cdk';
import { createExampleError } from './cdk-query-error.data';

@Component({
  selector: 'app-cdk-query-error-example',
  template: `
    <et-query-error [error]="retryableError" [query]="null" />
    <et-query-error [error]="validationError" [query]="null" language="de" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [QueryErrorComponent],
})
export class CdkQueryErrorExampleComponent {
  public retryableError = createExampleError(500, { message: 'Internal server error' });

  public validationError = createExampleError(400, {
    statusCode: 400,
    error: 'Bad Request',
    message: ['This is a test error', 'An other test error', 'And a third one'],
  });
}
