import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { TreeDirective, TreeNodeDirective, TreeRow } from './headless';
import { TREE_MARKERS, TreeMarker, TreeMarkerComponent } from './tree-marker.component';

const markerFor = (row: TreeRow<unknown>): TreeMarker => {
  if (row.childrenStatus === 'loading') return TREE_MARKERS.SPINNER;
  if (row.childrenError !== null) return TREE_MARKERS.WARNING;

  return row.isExpandable ? TREE_MARKERS.CHEVRON : TREE_MARKERS.NONE;
};

/**
 * The default tree: an indented, themed, keyboard-navigable rendering of a hierarchy, driven by the
 * headless {@link TreeDirective}. Rows show their label; project an `<ng-template etTreeNodeDef>` to
 * render them with markup instead.
 *
 * Branches load their children the first time they expand, so binding a lazy `[dataSource]` needs no
 * extra wiring - a branch that is still loading shows a spinner in place of its chevron, and one whose
 * load failed shows the message and reloads when selected again.
 *
 * @example
 * <et-tree [dataSource]="categories" [(value)]="categoryId" [(expandedValues)]="openBranches" />
 */
@Component({
  selector: 'et-tree',
  templateUrl: './tree.component.html',
  styleUrl: './tree.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [TreeNodeDirective, TreeMarkerComponent, NgTemplateOutlet],
  hostDirectives: [
    {
      directive: TreeDirective,
      inputs: ['dataSource', 'compareWith', 'selectionMode', 'value', 'expandedValues', 'disabled', 'toErrorMessage'],
      outputs: ['valueChange', 'expandedValuesChange', 'nodeActivate'],
    },
  ],
  host: {
    class: 'et-tree',
  },
})
export class TreeComponent<T = unknown> {
  protected tree = inject<TreeDirective<T>>(TreeDirective);

  /** Shown while the root level loads. */
  public loadingLabel = input('Loading…');

  /** Shown when the root level loaded no nodes at all. */
  public emptyLabel = input('Nothing to show');

  /** Appended to a failed level's message, to say that selecting the row loads it again. */
  public retryLabel = input('select to retry');

  /**
   * The rows plus their marker and template context, built together so each row's context object
   * survives change detection instead of being rebuilt on every pass.
   */
  protected rows = computed(() =>
    this.tree.visibleRows().map((row) => ({ row, marker: markerFor(row), context: { $implicit: row.node, row } })),
  );
}
