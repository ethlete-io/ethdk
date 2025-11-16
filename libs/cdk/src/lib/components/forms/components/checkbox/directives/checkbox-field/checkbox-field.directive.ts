import { ContentChildren, Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostClasses, switchQueryListChanges, TypedQueryList } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map, of, switchMap } from 'rxjs';
import { InputStateService } from '../../../../services';
import { CHECKBOX_TOKEN, CheckboxDirective } from '../checkbox/checkbox.directive';

export const CHECKBOX_FIELD_TOKEN = new InjectionToken<CheckboxFieldDirective>('ET_CHECKBOX_FIELD_DIRECTIVE_TOKEN');

@Directive({
  providers: [{ provide: CHECKBOX_FIELD_TOKEN, useExisting: CheckboxFieldDirective }],
  exportAs: 'etCheckboxField',
})
export class CheckboxFieldDirective {
  readonly inputState = inject<InputStateService<boolean>>(InputStateService);

  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  @ContentChildren(forwardRef(() => CHECKBOX_TOKEN), { descendants: true })
  set checkbox(checkbox: TypedQueryList<CheckboxDirective>) {
    this._checkbox$.next(checkbox);
  }
  private _checkbox$ = new BehaviorSubject<TypedQueryList<CheckboxDirective> | null>(null);

  readonly hostClassBindings = signalHostClasses({
    'et-checkbox-field--indeterminate': toSignal(
      this._checkbox$.pipe(
        switchQueryListChanges(),
        switchMap((checkboxes) => {
          if (!checkboxes?.length) {
            return of(null);
          }

          return combineLatest(checkboxes.map((checkbox) => checkbox.indeterminate$)).pipe(
            map((indeterminateStates) => indeterminateStates.some((isIndeterminate) => isIndeterminate)),
          );
        }),
      ),
    ),
  });
}
