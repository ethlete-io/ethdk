import { Directive, ElementRef, InjectionToken, inject } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SELECT_FIELD_TOKEN = new InjectionToken<SelectFieldDirective>('ET_SELECT_FIELD_DIRECTIVE_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  providers: [{ provide: SELECT_FIELD_TOKEN, useExisting: SelectFieldDirective }],
  exportAs: 'etSelectField',
})
export class SelectFieldDirective {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
}
