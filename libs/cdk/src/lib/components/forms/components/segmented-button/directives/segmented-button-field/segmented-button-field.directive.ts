import { AfterContentInit, ContentChildren, Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { createReactiveBindings, TypedQueryList } from '@ethlete/core';
import { combineLatest, map, startWith, switchMap } from 'rxjs';
import { InputStateService } from '../../../../services';
import { SegmentedButtonValue } from '../../types';
import { SEGMENTED_BUTTON_TOKEN, SegmentedButtonDirective } from '../segmented-button';

export const SEGMENTED_BUTTON_FIELD_TOKEN = new InjectionToken<SegmentedButtonFieldDirective>(
  'ET_SEGMENTED_BUTTON_FIELD_DIRECTIVE_TOKEN',
);

@Directive({
  standalone: true,
  providers: [{ provide: SEGMENTED_BUTTON_FIELD_TOKEN, useExisting: SegmentedButtonFieldDirective }],
  exportAs: 'etSegmentedButtonField',
})
export class SegmentedButtonFieldDirective implements AfterContentInit {
  readonly inputState = inject<InputStateService<SegmentedButtonValue>>(InputStateService);

  readonly _bindings = createReactiveBindings();

  @ContentChildren(forwardRef(() => SEGMENTED_BUTTON_TOKEN), { descendants: true })
  private _segmentedButton?: TypedQueryList<SegmentedButtonDirective>;

  ngAfterContentInit(): void {
    if (!this._segmentedButton) {
      return;
    }

    this._bindings.push({
      attribute: 'class.et-segmented-button-field--checked',
      observable: this._segmentedButton.changes.pipe(startWith(this._segmentedButton)).pipe(
        switchMap((buttons) =>
          combineLatest(
            buttons.filter((radio): radio is SegmentedButtonDirective => !!radio).map((button) => button.checked$),
          ),
        ),
        map((checked) => checked.some((value) => value)),
      ),
    });

    this._bindings.push({
      attribute: 'class.et-segmented-button-field--disabled',
      observable: this._segmentedButton.changes.pipe(startWith(this._segmentedButton)).pipe(
        switchMap((buttons) =>
          combineLatest(
            buttons.filter((radio): radio is SegmentedButtonDirective => !!radio).map((button) => button.disabled$),
          ),
        ),
        map((disabled) => disabled.some((value) => value)),
      ),
    });
  }
}
