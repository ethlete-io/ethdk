import { DestroyRef, Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError, injectHostElement } from '@ethlete/core';
import { TREE_ERROR_CODES } from '../tree-errors';
import { TreeDirective } from './tree.directive';
import { TreeNodeDefContext } from './tree.types';

/**
 * Replaces the default tree's plain-text row label with a template, for rows that need markup - an
 * icon per node type, a badge, a secondary line. The node is the template's implicit value, and its
 * full {@link TreeRow} is available as `let-row` for the level, expansion and load state.
 *
 * @example
 * <et-tree [dataSource]="files">
 *   <ng-template etTreeNodeDef let-node let-row="row">
 *     <i [etIcon]="row.isExpandable ? 'folder' : 'file'"></i>
 *     {{ node.label }}
 *   </ng-template>
 * </et-tree>
 */
@Directive({
  selector: 'ng-template[etTreeNodeDef]',
  exportAs: 'etTreeNodeDef',
})
export class TreeNodeDefDirective<T = unknown> {
  private hostElement = injectHostElement<Comment>();

  private tree = inject<TreeDirective<T>>(TreeDirective, { optional: true });

  public templateRef = inject<TemplateRef<TreeNodeDefContext<T>>>(TemplateRef);

  constructor() {
    this.tree?.nodeTemplate.set(this);

    inject(DestroyRef).onDestroy(() => {
      if (this.tree?.nodeTemplate() === this) {
        this.tree.nodeTemplate.set(null);
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.tree) {
          throw new RuntimeError(
            TREE_ERROR_CODES.PART_OUTSIDE_TREE,
            '[TreeNodeDefDirective] etTreeNodeDef must be placed inside an [etTree] element (e.g. <et-tree>).',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  // static on purpose (the lint ban excepts it): Angular's template type checker requires the
  // context guard to be static - it types the `let-` bindings of the host ng-template
  public static ngTemplateContextGuard<T>(
    _directive: TreeNodeDefDirective<T>,
    _context: unknown,
  ): _context is TreeNodeDefContext<T> {
    return true;
  }
}
