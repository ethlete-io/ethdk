import { AfterContentInit, ContentChild, ContentChildren, Directive, forwardRef, InjectionToken } from '@angular/core';
import { createDestroy, TypedQueryList } from '@ethlete/core';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  of,
  startWith,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs';
import {
  CHECKBOX_GROUP_CONTROL_TOKEN,
  CheckboxGroupControlDirective,
} from '../checkbox-group-control/checkbox-group-control.directive';
import { CHECKBOX_TOKEN, CheckboxDirective } from '../checkbox/checkbox.directive';

export const CHECKBOX_GROUP_TOKEN = new InjectionToken<CheckboxGroupDirective>('ET_CHECKBOX_GROUP_DIRECTIVE_TOKEN');

@Directive({
  host: {
    role: 'group',
  },
  exportAs: 'etCheckboxGroup',
  providers: [{ provide: CHECKBOX_GROUP_TOKEN, useExisting: CheckboxGroupDirective }],
})
export class CheckboxGroupDirective implements AfterContentInit {
  private readonly _destroy$ = createDestroy();

  @ContentChildren(forwardRef(() => CHECKBOX_TOKEN), { descendants: true })
  readonly checkboxes?: TypedQueryList<CheckboxDirective>;

  @ContentChild(forwardRef(() => CHECKBOX_GROUP_CONTROL_TOKEN))
  readonly groupControl?: CheckboxGroupControlDirective;

  readonly checkboxesWithoutGroupCtrlObservable$ = new BehaviorSubject<Observable<CheckboxDirective[]> | null>(null);

  readonly checkboxesWithoutGroupCtrl$ = this.checkboxesWithoutGroupCtrlObservable$.pipe(
    switchMap((value) => value ?? of([])),
  );

  ngAfterContentInit(): void {
    if (!this.groupControl) {
      console.warn('A checkbox group without a group control is totally useless.');
      return;
    }

    if (!this.checkboxes) {
      return;
    }

    this.checkboxesWithoutGroupCtrlObservable$.next(
      this.checkboxes.changes.pipe(
        startWith(this.checkboxes),
        map((queryList) =>
          queryList
            .toArray()
            .filter((cb): cb is CheckboxDirective => !!cb)
            .filter((cb) => cb.input.id !== this.groupControl?.checkbox.input.id),
        ),
      ),
    );

    if (this.groupControl.input.usesImplicitControl) {
      this.checkboxesWithoutGroupCtrl$
        .pipe(
          switchMap((checkboxes) => combineLatest(checkboxes.map((checkbox) => checkbox.input.disabled$))),
          map((disabledMap) => disabledMap.every((disabled) => disabled)),
          tap((allDisabled) => this.groupControl?.input._updateDisabled(allDisabled)),
          takeUntil(this._destroy$),
        )
        .subscribe();
    }

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
                this.groupControl.input._updateValue(true);
              } else {
                this.groupControl.input._updateValue(false, { emitEvent: false });
              }

              this.groupControl.checkbox.indeterminate$.next(!allChecked && !allUnchecked);
            }),
          ),
        ),
      )
      .subscribe();

    this.groupControl?.input.valueChange$
      .pipe(
        startWith(this.groupControl?.input.value),
        withLatestFrom(this.checkboxesWithoutGroupCtrl$),
        takeUntil(this._destroy$),
        tap(([checked, checkboxes]) => {
          for (const checkbox of checkboxes ?? []) {
            if (checkbox.input.id !== this.groupControl?.input.id) {
              checkbox.input._updateValue(!!checked);
            }
          }
        }),
      )
      .subscribe();
  }
}
