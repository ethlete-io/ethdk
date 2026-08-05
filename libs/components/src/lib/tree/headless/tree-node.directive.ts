import { Directive, ElementRef, afterNextRender, computed, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TREE_ERROR_CODES } from '../tree-errors';
import { TreeDirective } from './tree.directive';
import { TreeRow } from './tree.types';

/**
 * A single row of a tree. Bind the {@link TreeRow} it represents; the directive wires the ARIA tree
 * semantics (including the position values a flat DOM has to state), the roving tab stop and the
 * interaction, and mirrors the row's state as `data-*` attributes for styling.
 *
 * @example
 * @for (row of tree.visibleRows(); track row.node) {
 *   <div [row]="row" etTreeNode>{{ row.node.label }}</div>
 * }
 */
@Directive({
  selector: '[etTreeNode]',
  exportAs: 'etTreeNode',
  host: {
    role: 'treeitem',
    '[attr.aria-level]': 'row().level',
    '[attr.aria-posinset]': 'row().posInSet',
    '[attr.aria-setsize]': 'row().setSize',
    '[attr.aria-expanded]': 'row().isExpandable ? row().isExpanded : null',
    '[attr.aria-selected]': 'selectionMode() === "none" ? null : selected()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.aria-busy]': 'row().childrenStatus === "loading" ? "true" : null',
    '[attr.tabindex]': 'active() ? 0 : -1',
    '[attr.data-selected]': 'selected() || null',
    '[attr.data-expanded]': 'row().isExpanded || null',
    '[attr.data-branch]': 'row().isExpandable || null',
    '[attr.data-disabled]': 'disabled() || null',
    '[attr.data-error]': 'row().childrenError !== null || null',
    '(click)': 'handleClick()',
    '(keydown)': 'handleKeydown($event)',
    '(focusin)': 'handleFocusIn()',
  },
})
export class TreeNodeDirective<T = unknown> {
  private tree = inject<TreeDirective<T>>(TreeDirective, { optional: true });

  /** @internal The element the tree moves DOM focus to when roving focus lands on this row. */
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The row this element renders - one entry of the tree's `visibleRows()`. */
  public row = input.required<TreeRow<T>>();

  protected selectionMode = computed(() => this.tree?.selectionMode() ?? 'none');
  protected selected = computed(() => this.tree?.isSelected(this.row().node) ?? false);
  protected disabled = computed(() => this.row().isDisabled || (this.tree?.disabled() ?? false));

  protected active = computed(() => {
    const active = this.tree?.activeNode();

    if (!active || !this.tree) return false;

    return this.tree.compareWith()(active.value, this.row().node.value);
  });

  constructor() {
    this.tree?.registerNode(this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.tree) {
          throw new RuntimeError(
            TREE_ERROR_CODES.PART_OUTSIDE_TREE,
            '[TreeNodeDirective] etTreeNode must be placed inside an [etTree] element (e.g. <et-tree>).',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  protected handleClick() {
    this.tree?.activate(this.row().node);
  }

  protected handleKeydown(event: KeyboardEvent) {
    this.tree?.handleNodeKeydown(event, this.row().node);
  }

  protected handleFocusIn() {
    this.tree?.focusedNode.set(this.row().node);
  }
}
