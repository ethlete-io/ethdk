import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import {
  collectLeafPaths,
  detectPaginationShape,
  hasQueryDevtoolsOverridesAtPath,
  isDateShapedLeaf,
  JsonPath,
  QueryDevtoolsOverridesRecorder,
} from '@ethlete/query';
import {
  MenuComponent,
  MenuDirective,
  MenuItemComponent,
  MenuItemShortcutComponent,
  MenuSeparatorComponent,
} from '../menu';
import { MenuSurfaceDirective, MenuTriggerDirective } from '../menu/headless';
import { injectStyleManager } from '@ethlete/core';
import { JsonKind, kindOf } from './query-devtools-json.component';
import { QueryDevtoolsOverrideMenuStylesComponent } from './query-devtools-override-menu-styles.component';

/**
 * The per-value action menu of the query devtools value explorer: arms a path-addressed
 * {@link OverrideOp} on the query's response so it replays on every future fetch, instead of the
 * one-shot raw-JSON edit the panel's JIT editor offers.
 *
 * @internal
 */
@Component({
  selector: 'et-query-devtools-override-menu',
  templateUrl: './query-devtools-override-menu.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuItemComponent,
    MenuItemShortcutComponent,
    MenuSeparatorComponent,
  ],
})
export class QueryDevtoolsOverrideMenuComponent {
  public value = input<unknown>();
  public path = input<JsonPath>([]);
  public parentKind = input<JsonKind | null>(null);
  public overrides = input.required<QueryDevtoolsOverridesRecorder>();

  protected kind = computed(() => kindOf(this.value()));
  protected isContainer = computed(() => this.kind() === 'array' || this.kind() === 'object');
  protected isEmptyValue = computed(() => this.kind() === 'null' || this.kind() === 'undefined');
  protected hasArmedOverrides = computed(() => hasQueryDevtoolsOverridesAtPath(this.overrides().list(), this.path()));
  protected isArrayElement = computed(() => this.parentKind() === 'array' && this.kind() === 'object');
  protected paginationShape = computed(() => detectPaginationShape(this.value()));
  protected hasValueActions = computed(
    () => this.kind() !== 'object' || this.isArrayElement() || this.paginationShape() !== null,
  );
  protected isDate = computed(() => {
    const path = this.path();
    return this.kind() === 'string' && isDateShapedLeaf(path[path.length - 1] ?? null, this.value());
  });

  constructor() {
    injectStyleManager().mount(QueryDevtoolsOverrideMenuStylesComponent);
  }

  protected applyStringPreset(preset: 'short' | 'long' | 'unicode') {
    this.overrides().arm({ type: 'stringPreset', path: this.path(), preset });
  }

  protected applyNumberPreset(preset: 'zero' | 'negative' | 'huge') {
    this.overrides().arm({ type: 'numberPreset', path: this.path(), preset });
  }

  protected applyDatePreset(preset: 'now' | 'plusDay' | 'minusDay' | 'farFuture' | 'farPast' | 'invalid') {
    this.overrides().arm({ type: 'datePreset', path: this.path(), preset });
  }

  protected setValue(value: unknown) {
    this.overrides().arm({ type: 'set', path: this.path(), value });
  }

  protected flipBoolean() {
    this.overrides().arm({ type: 'booleanFlip', path: this.path() });
  }

  protected duplicateThisItem() {
    const path = this.path();
    const parentPath = path.slice(0, -1);
    const index = Number(path[path.length - 1]);

    this.overrides().arm({ type: 'duplicateArrayItem', path: parentPath, index });
  }

  protected duplicateArray() {
    this.overrides().arm({ type: 'duplicateArray', path: this.path() });
  }

  protected resizePagination(mode: 'shrink' | 'extend') {
    this.overrides().arm({ type: 'paginationResize', path: this.path(), mode, amount: 1 });
  }

  protected fillStrings() {
    for (const leaf of collectLeafPaths(this.value(), 'string')) {
      this.overrides().arm({ type: 'stringPreset', path: [...this.path(), ...leaf], preset: 'short' });
    }
  }

  protected fillNumbers() {
    for (const leaf of collectLeafPaths(this.value(), 'number')) {
      this.overrides().arm({ type: 'numberPreset', path: [...this.path(), ...leaf], preset: 'zero' });
    }
  }

  protected fillBooleans() {
    for (const leaf of collectLeafPaths(this.value(), 'boolean')) {
      this.overrides().arm({ type: 'booleanFlip', path: [...this.path(), ...leaf] });
    }
  }

  protected reset() {
    this.overrides().arm({ type: 'reset', path: this.path() });
  }
}
