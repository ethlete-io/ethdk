import { Directive, ElementRef, afterNextRender, computed, effect, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CASCADER_ERROR_CODES } from '../cascader-errors';
import { CascaderDirective } from './cascader.directive';
import { CascaderNode } from './internals/cascader-tree';

/**
 * One flat search result - a full root → node path. Bind the `[path]` it represents and its
 * `[index]` in the result list; the directive wires the option semantics, roving tabindex and
 * activation (committing the node, or jumping the columns to a branch-only match).
 */
@Directive({
  selector: '[etCascaderSearchOption]',
  exportAs: 'etCascaderSearchOption',
  host: {
    role: 'option',
    '[attr.aria-selected]': 'selected()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.tabindex]': 'focused() ? 0 : -1',
    '[attr.data-selected]': 'selected() || null',
    '[attr.data-focused]': 'focused() || null',
    '[attr.data-disabled]': 'disabled() || null',
    '(click)': 'handleClick()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class CascaderSearchOptionDirective<T = unknown> {
  private cascader = inject<CascaderDirective<T>>(CascaderDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The matching path (root → matching node) this element represents. */
  public path = input.required<CascaderNode<T>[]>();

  /** The result's index in the cascader's `searchState().results`. */
  public index = input.required<number>();

  /** The path's final node - the one an activation commits (or drills into). */
  public node = computed(() => this.path()[this.path().length - 1] ?? null);

  protected disabled = computed(() => this.node()?.disabled ?? false);

  protected selected = computed(() => {
    const node = this.node();

    return node ? (this.cascader?.isSelected(node) ?? false) : false;
  });

  protected focused = computed(() => this.cascader?.focusedSearchIndex() === this.index());

  constructor() {
    // pull DOM focus along with roving focus while the user is navigating inside the panel -
    // mirrors the node directive (results live in the same focus model)
    effect(() => {
      if (this.focused() && this.cascader?.focusInside()) {
        this.elementRef.nativeElement.focus({ preventScroll: true });
        this.elementRef.nativeElement.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.cascader) {
          throw new RuntimeError(
            CASCADER_ERROR_CODES.SEARCH_OPTION_OUTSIDE_CASCADER,
            '[CascaderSearchOptionDirective] etCascaderSearchOption must be rendered inside an [etCascader] element.',
          );
        }
      });
    }
  }

  protected handleClick() {
    this.cascader?.activateSearchResult(this.path());
  }

  protected handleKeydown(event: KeyboardEvent) {
    this.cascader?.handleSearchOptionKeydown(event, this.index());
  }
}
