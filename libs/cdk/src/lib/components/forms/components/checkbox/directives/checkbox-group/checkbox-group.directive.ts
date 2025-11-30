import { AfterContentInit, computed, contentChild, contentChildren, Directive, InjectionToken } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { createDestroy } from '@ethlete/core';
import { combineLatest, debounceTime, map, of, startWith, switchMap, takeUntil, tap, withLatestFrom } from 'rxjs';
import { CHECKBOX_GROUP_CONTROL_TOKEN } from '../checkbox-group-control/checkbox-group-control.directive';
import { CHECKBOX_TOKEN } from '../checkbox/checkbox.directive';

export const CHECKBOX_GROUP_TOKEN = new InjectionToken<CheckboxGroupDirective>('ET_CHECKBOX_GROUP_DIRECTIVE_TOKEN');

@Directive({
  host: {
    role: 'group',
  },
  exportAs: 'etCheckboxGroup',
  providers: [{ provide: CHECKBOX_GROUP_TOKEN, useExisting: CheckboxGroupDirective }],
})
export class CheckboxGroupDirective implements AfterContentInit {
  private destroy$ = createDestroy();

  checkboxes = contentChildren(CHECKBOX_TOKEN, { descendants: true });
  groupControl = contentChild(CHECKBOX_GROUP_CONTROL_TOKEN);

  checkboxesWithoutGroupCtrl = computed(() => {
    const groupControl = this.groupControl();
    const checkboxes = this.checkboxes();

    if (!groupControl) return checkboxes;

    return checkboxes.filter((cb) => cb.input.id !== groupControl.checkbox.input.id);
  });

  checkboxes$ = toObservable(this.checkboxes);
  groupControl$ = toObservable(this.groupControl);
  checkboxesWithoutGroupCtrl$ = toObservable(this.checkboxesWithoutGroupCtrl);

  ngAfterContentInit(): void {
    const groupControl = this.groupControl();
    if (!groupControl) {
      console.warn('A checkbox group without a group control is totally useless.');
      return;
    }

    if (groupControl.input.usesImplicitControl) {
      this.checkboxesWithoutGroupCtrl$
        .pipe(
          switchMap((checkboxes) => combineLatest(checkboxes.map((checkbox) => checkbox.input.disabled$))),
          map((disabledMap) => disabledMap.every((disabled) => disabled)),
          tap((allDisabled) => this.groupControl()?.input._updateDisabled(allDisabled)),
          takeUntil(this.destroy$),
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
        takeUntil(this.destroy$),
        switchMap((checkboxes) =>
          combineLatest(checkboxes.map((checkbox) => checkbox.input.value$)).pipe(
            debounceTime(0),
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
      .pipe(
        switchMap((groupControl) =>
          groupControl ? groupControl.input.value$.pipe(startWith(groupControl.input.value)) : of(null),
        ),
      )
      .pipe(
        withLatestFrom(this.checkboxesWithoutGroupCtrl$),
        takeUntil(this.destroy$),
        tap(([checked, checkboxes]) => {
          for (const checkbox of checkboxes) {
            if (checkbox.input.id !== this.groupControl()?.input.id) {
              checkbox.input._updateValue(!!checked);
            }
          }
        }),
      )
      .subscribe();
  }
}
