import { Directive, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostClasses } from '@ethlete/core';
import { map } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SLIDE_TOGGLE_TOKEN = new InjectionToken<SlideToggleDirective>('ET_SLIDE_TOGGLE_DIRECTIVE_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  providers: [{ provide: SLIDE_TOGGLE_TOKEN, useExisting: SlideToggleDirective }],
  exportAs: 'etSlideToggle',
})
export class SlideToggleDirective {
  readonly input = inject<InputDirective<boolean>>(INPUT_TOKEN);
  readonly checked$ = this.input.value$.pipe(map((value) => !!value));

  readonly hostClassBindings = signalHostClasses({
    'et-slide-toggle--checked': toSignal(this.checked$),
    'et-slide-toggle--disabled': toSignal(this.input.disabled$),
  });

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    this.input._updateValue(!this.input.value);

    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }
}
