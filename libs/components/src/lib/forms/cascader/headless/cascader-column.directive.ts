import { DestroyRef, Directive, afterNextRender, computed, inject, input } from '@angular/core';
import { RuntimeError, createComponentId, injectHostElement } from '@ethlete/core';
import { CASCADER_ERROR_CODES } from '../cascader-errors';
import { CascaderDirective } from './cascader.directive';
import { injectCascaderLabels } from '../cascader-labels';

/** One level of the hierarchy - a `role="group"` of tree items. Nodes read their level from it. */
@Directive({
  selector: '[etCascaderColumn]',
  exportAs: 'etCascaderColumn',
  host: {
    role: 'group',
    '[attr.id]': 'id',
    '[attr.aria-label]': 'ariaLabel()',
  },
})
export class CascaderColumnDirective {
  private cascaderLabels = injectCascaderLabels();

  public cascader = inject(CascaderDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private readonly hostElement = injectHostElement();

  /** The column's zero-based level - column 0 shows the root. */
  public columnIndex = input.required<number>({ alias: 'etCascaderColumn' });

  public readonly id = createComponentId('et-cascader-column');

  protected ariaLabel = computed(() => {
    const index = this.columnIndex();
    const parent = this.cascader?.columns()[index]?.parent;

    return parent ? parent.label : this.cascaderLabels().options;
  });

  constructor() {
    // a keydown that bubbled up from a node without being handled (rare) is ignored here;
    // navigation lives on the nodes so roving focus stays exact
    void this.destroyRef;

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.cascader) {
          throw new RuntimeError(
            CASCADER_ERROR_CODES.COLUMN_OUTSIDE_CASCADER,
            '[CascaderColumnDirective] etCascaderColumn must be rendered inside an [etCascader] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
