import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { RequestError } from '@ethlete/query';
import { QueryErrorComponent } from '../../components';

@Component({
  selector: 'et-sb-query-error',
  template: ` <et-query-error *ngIf="error" [error]="error" [query]="null" /> `,
  styles: [
    `
      .et-query-error {
        display: block;
        border: 1px solid #e0e0e0;
        padding: 16px;
      }
    `,
  ],
  standalone: true,
  imports: [QueryErrorComponent, NgIf],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryErrorStorybookComponent {
  @Input()
  error: RequestError | null = null;
}
