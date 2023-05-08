import { AfterContentInit, ContentChildren, Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { createFlipAnimation, createReactiveBindings, DestroyService, TypedQueryList } from '@ethlete/core';
import { combineLatest, map, pairwise, startWith, takeUntil, tap } from 'rxjs';
import { FormGroupStateService, InputStateService } from '../../../../services';
import { SegmentedButtonValue } from '../../types';
import { SEGMENTED_BUTTON_TOKEN, SegmentedButtonDirective } from '../public-api';

export const SEGMENTED_BUTTON_GROUP_TOKEN = new InjectionToken<SegmentedButtonGroupDirective>(
  'ET_SEGMENTED_BUTTON_GROUP_DIRECTIVE_TOKEN',
);

let nextUniqueId = 0;

@Directive({
  standalone: true,
  providers: [{ provide: SEGMENTED_BUTTON_GROUP_TOKEN, useExisting: SegmentedButtonGroupDirective }, DestroyService],
  exportAs: 'etSegmentedButtonGroup',
  host: {
    role: 'group',
  },
})
export class SegmentedButtonGroupDirective implements AfterContentInit {
  private readonly _formGroupStateService = inject(FormGroupStateService);
  private readonly _inputStateService =
    inject<InputStateService<SegmentedButtonValue, HTMLButtonElement>>(InputStateService);
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;

  readonly name = `et-segmented-button-group-${++nextUniqueId}`;

  readonly _bindings = createReactiveBindings({
    attribute: 'aria-labelledby',
    observable: this._formGroupStateService.describedBy$.pipe(
      map((describedBy) => {
        return {
          render: !!describedBy,
          value: `${describedBy}`,
        };
      }),
    ),
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
