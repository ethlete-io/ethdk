import {
  Component,
  TemplateRef,
  ViewEncapsulation,
  afterNextRender,
  contentChild,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TAB_ERROR_CODES } from '../tab-errors';
import { TAB_GROUP_TOKEN } from './headless/tab-group.tokens';
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
  host: {
    class: 'et-tab',
    style: 'display: none',
  },
})
export class TabComponent {
  private tabGroup = inject(TAB_GROUP_TOKEN, { optional: true });

  public label = input('');
  public icon = input<string | null>(null);
  public disabled = input(false);

  public customLabel = contentChild(TabLabelDirective);
  /** @internal */
  public implicitLabelRef = viewChild.required<TemplateRef<unknown>>('implicitLabel');
  /** @internal */
  public contentRef = viewChild.required<TemplateRef<unknown>>('contentTpl');

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.tabGroup) {
          throw new RuntimeError(
            TAB_ERROR_CODES.MISSING_TAB_GROUP,
            '[TabComponent] <et-tab> must be placed inside an <et-tab-group> element.',
          );
        }
      });
    }
  }
}
