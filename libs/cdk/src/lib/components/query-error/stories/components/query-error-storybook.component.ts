import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { RequestError } from '@ethlete/query';
import { QueryErrorComponent } from '../../components/query-error';

@Component({
  selector: 'et-sb-query-error',
  template: `
    @if (error()) {
      <et-query-error [error]="error()" [query]="null" />
    }
  `,
  styles: [
    `
      .et-query-error {
        display: block;
        border: 1px solid #e0e0e0;
        padding: 16px;
      }
    `,
  ],
  imports: [QueryErrorComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryErrorStorybookComponent {
  readonly error = input<RequestError | null>(null);
}
