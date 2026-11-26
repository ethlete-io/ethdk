import { DestroyRef, Directive, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FieldTree, submit } from '@angular/forms/signals';
import { from, tap } from 'rxjs';
import { focusFirstInvalidField } from './focus-first-invalid-field';

/**
 * Wires a `<form>` to the signal form it edits: it submits through the form's own
 * `submission.action`, and a submit that does not pass validation scrolls the first invalid field
 * into view and focuses it.
 *
 * ```html
 * <form [etForm]="form">…</form>
 * ```
 *
 * The form declares what submitting means, so the template needs no handler and no
 * `$event.preventDefault()`:
 *
 * ```ts
 * protected form = form(this.model, mySchema, {
 *   submission: { action: async (field) => save(field().value()) },
 * });
 * ```
 *
 * Leave the submit button enabled while the form is invalid. Submitting marks every field touched,
 * which is what makes the errors appear, and the first one is scrolled to - a disabled button
 * instead says "no" without ever saying why. Bind `[loading]="form().submitting()"` for the in-flight
 * state, and keep `disabled` for reasons that are not validity (a missing permission, data still
 * loading).
 */
@Directive({
  selector: 'form[etForm]',
  host: {
    novalidate: '',
    '(submit)': 'handleSubmit($event)',
  },
})
export class FormDirective<T> {
  private destroyRef = inject(DestroyRef);

  public field = input.required<FieldTree<T>>({ alias: 'etForm' });

  protected handleSubmit(event: Event) {
    event.preventDefault();

    const field = this.field();

    if (field().submitting()) {
      return;
    }

    from(submit(field))
      .pipe(
        tap((success) => {
          if (!success) {
            focusFirstInvalidField(field);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
