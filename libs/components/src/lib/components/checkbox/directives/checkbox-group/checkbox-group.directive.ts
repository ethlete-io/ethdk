import { AfterContentInit, ContentChild, ContentChildren, Directive, inject, QueryList } from '@angular/core';
import { DestroyService } from '@ethlete/core';
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

  @ContentChildren(CHECKBOX_TOKEN)
  checkboxes?: QueryList<CheckboxDirective>;

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
      map(() => {
        const cbs = this.checkboxes?.toArray() ?? [];

        return cbs.filter((cb) => cb.uniqueId !== this.groupControl?.checkbox.uniqueId);
      }),
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
          combineLatest(checkboxes.map((checkbox) => checkbox.change.pipe(startWith(checkbox.checked)))).pipe(
            tap((checkStates) => {
              if (!this.groupControl) {
                return;
              }

              const allChecked = checkStates.every((checked) => checked);
              const allUnchecked = checkStates.every((checked) => !checked);

              if (allChecked) {
                this.groupControl.checkbox.writeValue(true);
              } else {
                this.groupControl.checkbox.writeValue(false);
              }

              this.groupControl.checkbox.indeterminate = !allChecked && !allUnchecked;
              this.groupControl.checkbox._markForCheck();
            }),
          ),
        ),
      )
      .subscribe();

    this.groupControl?.checkbox.change
      .pipe(
        startWith(this.groupControl?.checkbox.checked),
        withLatestFrom(this.checkboxesWithoutGroupCtrl$),
        takeUntil(this._destroy$),
        tap(([checked, checkboxes]) => {
          for (const checkbox of checkboxes ?? []) {
            if (checkbox.uniqueId !== this.groupControl?.checkbox.uniqueId) {
              checkbox.writeValue(checked);
              checkbox._markForCheck();
            }
          }

          for (const checkbox of checkboxes ?? []) {
            checkbox._emitChangeEvent();
          }
        }),
      )
      .subscribe();
  }
}
