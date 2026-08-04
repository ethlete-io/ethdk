import { AsyncPipe } from '@angular/common';
import { Component, inject, InjectionToken, ViewEncapsulation } from '@angular/core';
import { FormFieldStateService } from '../../../../services';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const LABEL_TOKEN = new InjectionToken<LabelComponent>('ET_LABEL_COMPONENT_TOKEN');

let nextUniqueId = 0;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-label',
  template: `
    <label
      [attr.for]="formFieldStateService.inputId$ | async"
      [attr.aria-owns]="formFieldStateService.inputId$ | async"
      [id]="id"
      class="et-label-native-label"
    >
      <ng-content />
    </label>
    <ng-content select="[etLabelSuffix]" />
  `,
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etLabel',
  imports: [AsyncPipe],
  providers: [{ provide: LABEL_TOKEN, useExisting: LabelComponent }],
  host: {
    class: 'et-label et-legacy',
  },
})
export class LabelComponent {
  protected readonly formFieldStateService = inject(FormFieldStateService);

  readonly id = `et-label-${++nextUniqueId}`;
}
