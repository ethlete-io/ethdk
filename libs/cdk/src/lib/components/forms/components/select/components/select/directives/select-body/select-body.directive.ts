import { Directive, ElementRef, InjectionToken, inject } from '@angular/core';
import { outputToObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ClickOutsideDirective, signalHostAttributes } from '@ethlete/core';
import { tap } from 'rxjs';
import { SELECT_TOKEN } from '../select';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SELECT_BODY_TOKEN = new InjectionToken<SelectBodyDirective>('ET_SELECT_BODY_TOKEN');

let uniqueId = 0;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  providers: [
    {
      provide: SELECT_BODY_TOKEN,
      useExisting: SelectBodyDirective,
    },
  ],
  host: {
    '[attr.id]': 'id',
    tabindex: '-1',
    role: 'listbox',
  },
  hostDirectives: [ClickOutsideDirective],
})
export class SelectBodyDirective {
  readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _select = inject(SELECT_TOKEN);
  private readonly _clickOutside = inject(ClickOutsideDirective);

  readonly id = `et-select-body-${uniqueId++}`;

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-multiselectable': toSignal(this._select.multiple$),
    'aria-labelledby': toSignal(this._select.input.labelId$),
  });

  constructor() {
    outputToObservable(this._clickOutside.didClickOutside)
      .pipe(
        takeUntilDestroyed(),
        tap(() => this._select.close()),
      )
      .subscribe();
  }
}
