import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, InjectionToken, ViewEncapsulation } from '@angular/core';
import { FormFieldStateService } from '../../../../services';

export const LABEL_TOKEN = new InjectionToken<LabelComponent>('ET_LABEL_COMPONENT_TOKEN');

let nextUniqueId = 0;

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: 'etLabel',
  imports: [AsyncPipe],
  providers: [{ provide: LABEL_TOKEN, useExisting: LabelComponent }],
  host: {
    class: 'et-label',
  },
})
export class LabelComponent {
  protected readonly formFieldStateService = inject(FormFieldStateService);

  readonly id = `et-label-${++nextUniqueId}`;
}
