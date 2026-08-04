import { ContentChildren, Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostClasses, switchQueryListChanges, TypedQueryList } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map, of, switchMap } from 'rxjs';
import { InputStateService } from '../../../../services';
import { Primitive } from '../../../select/components/combobox/utils';
import { SEGMENTED_BUTTON_TOKEN, SegmentedButtonDirective } from '../segmented-button';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SEGMENTED_BUTTON_FIELD_TOKEN = new InjectionToken<SegmentedButtonFieldDirective>(
  'ET_SEGMENTED_BUTTON_FIELD_DIRECTIVE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  providers: [{ provide: SEGMENTED_BUTTON_FIELD_TOKEN, useExisting: SegmentedButtonFieldDirective }],
  exportAs: 'etSegmentedButtonField',
})
export class SegmentedButtonFieldDirective {
  readonly inputState = inject<InputStateService<Primitive>>(InputStateService);

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
