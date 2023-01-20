import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, InjectionToken, ViewEncapsulation } from '@angular/core';
import { InputStateService } from '../../../../services';

export const LABEL_TOKEN = new InjectionToken<LabelComponent>('ET_LABEL_COMPONENT_TOKEN');

let nextUniqueId = 0;

@Component({
  selector: 'et-label',
  template: `
    <label
      [attr.for]="inputStateService.inputId$ | async"
      [attr.aria-owns]="inputStateService.inputId$ | async"
      [id]="id"
      class="et-label-label"
    >
      <ng-content />
    </label>
    <ng-content select="[etLabelSuffix]" />
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  exportAs: 'etLabel',
  imports: [AsyncPipe],
  providers: [{ provide: LABEL_TOKEN, useExisting: LabelComponent }],
  host: {
    class: 'et-label',
  },
})
export class LabelComponent {
  protected readonly inputStateService = inject(InputStateService);

  readonly id = `et-label-${++nextUniqueId}`;
}
