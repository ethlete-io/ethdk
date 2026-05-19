import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewEncapsulation,
  contentChild,
  input,
  viewChild,
} from '@angular/core';
import { TabLabelDirective } from './tab-label.directive';

@Component({
  selector: 'et-tab',
  template: `
    <ng-template #implicitLabel>{{ label() }}</ng-template>
    <ng-template #contentTpl>
      <ng-content />
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-tab',
    style: 'display: none',
  },
})
export class TabComponent {
  public label = input('');
  public icon = input<string | null>(null);
  public disabled = input(false);

  public customLabel = contentChild(TabLabelDirective);
  /** @internal */
  public implicitLabelRef = viewChild.required<TemplateRef<unknown>>('implicitLabel');
  /** @internal */
  public contentRef = viewChild.required<TemplateRef<unknown>>('contentTpl');
}
