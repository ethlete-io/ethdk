import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { TREE_SELECTION_MODES, TreeDirective, TreeNodeDirective, TreeRow } from './headless';
import { TREE_MARKERS, TreeMarker, TreeMarkerComponent } from './tree-marker.component';
import { injectTreeLabels, TreeLabels } from './tree-labels';

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

  private injectedLabels = injectTreeLabels();

  /** Per-instance overrides for the tree's strings, merged over the injected `TREE_LABELS`. */
  public labels = input<Partial<TreeLabels> | null>(null);

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<TreeLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  /**
   * The rows plus their marker and template context, built together so each row's context object
   * survives change detection instead of being rebuilt on every pass.
   */
  protected rows = computed(() =>
    this.tree.visibleRows().map((row) => ({ row, marker: markerFor(row), context: { $implicit: row.node, row } })),
  );

  protected isMultiSelect = computed(() => this.tree.selectionMode() === TREE_SELECTION_MODES.MULTIPLE);
}
