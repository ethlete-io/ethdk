import { AfterContentInit, ContentChild, ContentChildren, Directive, inject } from '@angular/core';
import { DestroyService, TypedQueryList } from '@ethlete/core';
import { combineLatest, map, Observable, startWith, switchMap, takeUntil, tap, withLatestFrom } from 'rxjs';
import {
  CheckboxGroupControlDirective,
  CHECKBOX_GROUP_CONTROL_TOKEN,
} from '../checkbox-group-control/checkbox-group-control.directive';
import { CheckboxDirective, CHECKBOX_TOKEN } from '../checkbox/checkbox.directive';

@Directive({
  standalone: true,
})
export class CheckboxGroupDirective implements AfterContentInit {
  private readonly _destroy$ = inject(DestroyService).destroy$;

  @ContentChildren(CHECKBOX_TOKEN, { descendants: true })
  checkboxes?: TypedQueryList<CheckboxDirective>;

  @ContentChild(CHECKBOX_GROUP_CONTROL_TOKEN)
  groupControl?: CheckboxGroupControlDirective;

  checkboxesWithoutGroupCtrl$?: Observable<CheckboxDirective[]>;

  ngAfterContentInit(): void {
    if (!this.groupControl) {
      console.warn('A checkbox group without a group control is totally useless.');
      return;
    }

    this.checkboxesWithoutGroupCtrl$ = this.checkboxes?.changes.pipe(
      startWith(this.checkboxes),
      map((queryList) => queryList.toArray().filter((cb) => cb.input.id !== this.groupControl?.checkbox.input.id)),
    );

    this._monitorCheckboxes();
  }

  private _monitorCheckboxes(): void {
    if (!this.checkboxesWithoutGroupCtrl$) {
      return;
    }

    this.checkboxesWithoutGroupCtrl$
      .pipe(
        takeUntil(this._destroy$),
        switchMap((checkboxes) =>
          combineLatest(checkboxes.map((checkbox) => checkbox.input.value$)).pipe(
            tap((checkStates) => {
              if (!this.groupControl) {
                return;
              }

              const allChecked = checkStates.every((checked) => checked);
              const allUnchecked = checkStates.every((checked) => !checked);

              if (allChecked) {
                this.groupControl.checkbox.input._updateValue(true);
              } else {
                this.groupControl.checkbox.input._updateValue(false, { emitEvent: false });
              }

              this.groupControl.checkbox.indeterminate$.next(!allChecked && !allUnchecked);
            }),
          ),
        ),
      )
      .subscribe();

    this.groupControl?.checkbox.input.valueChange$
      .pipe(
        startWith(this.groupControl?.checkbox.input.value),
        withLatestFrom(this.checkboxesWithoutGroupCtrl$),
        takeUntil(this._destroy$),
        tap(([checked, checkboxes]) => {
          for (const checkbox of checkboxes ?? []) {
            if (checkbox.input.id !== this.groupControl?.checkbox.input.id) {
              checkbox.input._updateValue(!!checked);
            }
          }
        }),
      )
      .subscribe();
  }
}
