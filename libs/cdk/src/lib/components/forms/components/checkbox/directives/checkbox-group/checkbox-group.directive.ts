import { AfterContentInit, contentChild, contentChildren, Directive, forwardRef, InjectionToken } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { createDestroy } from '@ethlete/core';
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
import { CHECKBOX_GROUP_CONTROL_TOKEN } from '../checkbox-group-control/checkbox-group-control.directive';
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

  readonly checkboxes = contentChildren(
    forwardRef(() => CHECKBOX_TOKEN),
    { descendants: true },
  );
  readonly checkboxes$ = toObservable(this.checkboxes);

  readonly groupControl = contentChild(forwardRef(() => CHECKBOX_GROUP_CONTROL_TOKEN));
  readonly groupControl$ = toObservable(this.groupControl);

  readonly checkboxesWithoutGroupCtrlObservable$ = new BehaviorSubject<Observable<CheckboxDirective[]> | null>(null);

  readonly checkboxesWithoutGroupCtrl$ = this.checkboxesWithoutGroupCtrlObservable$.pipe(
    switchMap((value) => value ?? of([])),
  );

  ngAfterContentInit(): void {
    const groupControl = this.groupControl();
    if (!groupControl) {
      console.warn('A checkbox group without a group control is totally useless.');
      return;
    }

    this.checkboxesWithoutGroupCtrlObservable$.next(
      this.checkboxes$.pipe(
        map((cbs) =>
          cbs
            .filter((cb): cb is CheckboxDirective => !!cb)
            .filter((cb) => cb.input.id !== this.groupControl()?.checkbox.input.id),
        ),
      ),
    );

    if (groupControl.input.usesImplicitControl) {
      this.checkboxesWithoutGroupCtrl$
        .pipe(
          switchMap((checkboxes) => combineLatest(checkboxes.map((checkbox) => checkbox.input.disabled$))),
          map((disabledMap) => disabledMap.every((disabled) => disabled)),
          tap((allDisabled) => this.groupControl()?.input._updateDisabled(allDisabled)),
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
              const groupControl = this.groupControl();
              if (!groupControl) {
                return;
              }

              const allChecked = checkStates.every((checked) => checked);
              const allUnchecked = checkStates.every((checked) => !checked);

              if (allChecked) {
                groupControl.input._updateValue(true);
              } else {
                groupControl.input._updateValue(false, { emitEvent: false });
              }

              groupControl.checkbox.indeterminate$.next(!allChecked && !allUnchecked);
            }),
          ),
        ),
      )
      .subscribe();

    this.groupControl$
      .pipe(switchMap((groupControl) => groupControl.input.value$.pipe(startWith(groupControl.input.value))))
      .pipe(
        withLatestFrom(this.checkboxesWithoutGroupCtrl$),
        takeUntil(this._destroy$),
        tap(([checked, checkboxes]) => {
          for (const checkbox of checkboxes ?? []) {
            if (checkbox.input.id !== this.groupControl()?.input.id) {
              checkbox.input._updateValue(!!checked);
            }
          }
        }),
      )
      .subscribe();
  }
}
