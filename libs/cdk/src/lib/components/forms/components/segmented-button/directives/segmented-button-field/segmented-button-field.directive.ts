import { ContentChildren, Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Primitive, signalHostClasses, switchQueryListChanges, TypedQueryList } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map, of, switchMap } from 'rxjs';
import { InputStateService } from '../../../../services';
import { SEGMENTED_BUTTON_TOKEN, SegmentedButtonDirective } from '../segmented-button';

export const SEGMENTED_BUTTON_FIELD_TOKEN = new InjectionToken<SegmentedButtonFieldDirective>(
  'ET_SEGMENTED_BUTTON_FIELD_DIRECTIVE_TOKEN',
);

@Directive({
  providers: [{ provide: SEGMENTED_BUTTON_FIELD_TOKEN, useExisting: SegmentedButtonFieldDirective }],
  exportAs: 'etSegmentedButtonField',
})
export class SegmentedButtonFieldDirective {
  readonly inputState = inject<InputStateService<Primitive>>(InputStateService);

  @ContentChildren(forwardRef(() => SEGMENTED_BUTTON_TOKEN), { descendants: true })
  set segmentedButton(segmentedButton: TypedQueryList<SegmentedButtonDirective>) {
    this._segmentedButton$.next(segmentedButton);
  }
  private _segmentedButton$ = new BehaviorSubject<TypedQueryList<SegmentedButtonDirective> | null>(null);

  readonly segmentedButtonQueryList$ = this._segmentedButton$.pipe(switchQueryListChanges());

  readonly hostClassBindings = signalHostClasses({
    'et-segmented-button-field--checked': toSignal(
      this.segmentedButtonQueryList$.pipe(
        switchMap((buttons) => (buttons?.length ? combineLatest(buttons.map((radio) => radio.checked$)) : of([]))),
        map((checked) => checked.some((value) => value)),
      ),
    ),
    'et-segmented-button-field--disabled': toSignal(
      this.segmentedButtonQueryList$.pipe(
        switchMap((buttons) => (buttons?.length ? combineLatest(buttons.map((radio) => radio.disabled$)) : of([]))),
        map((disabled) => disabled.some((value) => value)),
      ),
    ),
  });
}
