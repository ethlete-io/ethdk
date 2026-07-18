import { DestroyRef, Directive, ElementRef, afterNextRender, computed, effect, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CASCADER_ERROR_CODES } from '../cascader-errors';
import { CascaderColumnDirective } from './cascader-column.directive';
import { CascaderDirective } from './cascader.directive';
import { canHaveChildren, nodesEqual } from './internals/cascader-tree';

/**
 * A single tree item in a column. Bind the `[node]` it represents; the directive wires the
 * ARIA tree semantics, roving tabindex and interaction, mirroring the node's flags as
 * `data-*` attributes for styling.
 */
@Directive({
  selector: '[etCascaderNode]',
  exportAs: 'etCascaderNode',
  host: {
    role: 'treeitem',
    '[attr.aria-level]': 'column.columnIndex() + 1',
    '[attr.aria-selected]': 'selected()',
    '[attr.aria-expanded]': 'expandable() ? expanded() : null',
    '[attr.aria-disabled]': 'node().disabled || null',
    '[attr.tabindex]': 'focused() ? 0 : -1',
    '[attr.data-selected]': 'selected() || null',
    '[attr.data-indeterminate]': 'indeterminate() || null',
    '[attr.data-expanded]': 'expanded() || null',
    '[attr.data-focused]': 'focused() || null',
    '[attr.data-disabled]': 'node().disabled || null',
    '[attr.data-branch]': 'expandable() || null',
    '(click)': 'handleClick()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class CascaderNodeDirective<T = unknown> {
  protected column = inject(CascaderColumnDirective);
  private cascader = inject<CascaderDirective<T>>(CascaderDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  /** The node this element represents. */
  public node = input.required<{
    value: T;
    label: string;
    isLeaf?: boolean;
    hasChildren?: boolean;
    disabled?: boolean;
  }>({
    alias: 'node',
  });

  protected expandable = computed(() => canHaveChildren(this.node()));
  protected selected = computed(() => this.cascader?.isSelected(this.node()) ?? false);
  protected indeterminate = computed(() => this.cascader?.isIndeterminate(this.node()) ?? false);
  protected expanded = computed(() => this.cascader?.isExpanded(this.node(), this.column.columnIndex()) ?? false);

  protected focused = computed(() =>
    nodesEqual({
      a: this.cascader?.focusedNode() ?? null,
      b: this.node(),
      compareWith: this.cascader?.compareWith() ?? ((a, b) => a === b),
    }),
  );

  constructor() {
    // pull DOM focus along with roving focus, but only while the user is navigating inside
    // the panel — otherwise an unrelated render would steal focus back into the tree. The
    // focus pulse re-runs this after the panel settles (the opening click re-focuses the trigger).
    // While the search input holds DOM focus, only an explicit pulse (ArrowDown from the
    // input) may take it — a mere re-render, like the columns returning after the query was
    // deleted, must not pull focus out of the input mid-typing.
    let lastPulse: number | null = null;

    effect(() => {
      const pulse = this.cascader?.focusPulse() ?? 0;
      const pulsed = lastPulse !== null && pulse !== lastPulse;

      lastPulse = pulse;

      if (!this.focused() || !this.cascader?.focusInside()) {
        return;
      }

      if (!pulsed && this.cascader.registeredSearch()?.isFocused()) {
        return;
      }

      this.elementRef.nativeElement.focus({ preventScroll: true });
      this.elementRef.nativeElement.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.cascader) {
          throw new RuntimeError(
            CASCADER_ERROR_CODES.NODE_OUTSIDE_COLUMN,
            '[CascaderNodeDirective] etCascaderNode must be rendered inside an [etCascader] element.',
          );
        }
      });
    }

    void this.destroyRef;
  }

  protected handleClick() {
    this.cascader?.activateNode(this.node(), this.column.columnIndex());
  }

  protected handleKeydown(event: KeyboardEvent) {
    this.cascader?.handleNodeKeydown(event, { node: this.node(), columnIndex: this.column.columnIndex() });
  }
}
