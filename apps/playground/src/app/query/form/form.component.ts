import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { QueryField, QueryForm } from '@ethlete/query';

@Component({
  selector: 'ethlete-query-form',
  template: ` <input [formControl]="form.controls.query" type="text" /> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule],
})
export class QueryFormComponent {
  form = new QueryForm({
    query: new QueryField({
      control: new FormControl(''),
      debounce: 300,
      disableDebounceIfFalsy: true,
    }),
  });

  constructor() {
    this.form.changes$.pipe(takeUntilDestroyed()).subscribe((changes) => {
      console.log(changes);
    });

    this.form.observe();
  }
}
