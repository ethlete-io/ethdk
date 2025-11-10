import { AfterContentInit, ContentChildren, Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { createDestroy, createFlipAnimation, Primitive, signalHostAttributes, TypedQueryList } from '@ethlete/core';
import { combineLatest, pairwise, startWith, takeUntil, tap } from 'rxjs';
import { FormGroupStateService, InputStateService } from '../../../../services';
import { SEGMENTED_BUTTON_TOKEN, SegmentedButtonDirective } from '../segmented-button/segmented-button.directive';

export const SEGMENTED_BUTTON_GROUP_TOKEN = new InjectionToken<SegmentedButtonGroupDirective>(
  'ET_SEGMENTED_BUTTON_GROUP_DIRECTIVE_TOKEN',
);

let nextUniqueId = 0;

@Directive({
  providers: [{ provide: SEGMENTED_BUTTON_GROUP_TOKEN, useExisting: SegmentedButtonGroupDirective }],
  exportAs: 'etSegmentedButtonGroup',
  host: {
    role: 'group',
  },
})
export class SegmentedButtonGroupDirective implements AfterContentInit {
  private readonly _formGroupStateService = inject(FormGroupStateService);
  private readonly _inputStateService = inject<InputStateService<Primitive, HTMLButtonElement>>(InputStateService);
  private readonly _destroy$ = createDestroy();

  readonly name = `et-segmented-button-group-${++nextUniqueId}`;

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-labelledby': toSignal(this._formGroupStateService.describedBy$),
  });

  @ContentChildren(forwardRef(() => SEGMENTED_BUTTON_TOKEN), { descendants: true })
  private _segmentedButtons?: TypedQueryList<SegmentedButtonDirective>;

  ngAfterContentInit(): void {
    if (!this._segmentedButtons) {
      return;
    }

    combineLatest([
      this._segmentedButtons.changes.pipe(startWith(this._segmentedButtons)),
      this._inputStateService.value$.pipe(pairwise()),
    ])
      .pipe(
        tap(([buttons, [prevValue, currValue]]) => {
          const prevActiveIndicator = buttons.find((button) => button?.value === prevValue);
          const currActiveIndicator = buttons.find((button) => button?.value === currValue);

          if (
            !prevActiveIndicator ||
            !currActiveIndicator ||
            prevActiveIndicator === currActiveIndicator ||
            !prevActiveIndicator.activeIndicatorElement ||
            !currActiveIndicator.activeIndicatorElement
          ) {
            return;
          }

          const flip = createFlipAnimation({
            originElement: prevActiveIndicator.activeIndicatorElement,
            element: currActiveIndicator.activeIndicatorElement,
          });

          flip.play();
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }
}
