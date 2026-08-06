import { Component, computed, effect, ElementRef, input, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { injectErrorTheme, injectStyleManager, ProvideColorDirective } from '@ethlete/core';
import {
  collectLeafPaths,
  detectPaginationShape,
  generateQueryDevtoolsNumberPreset,
  generateQueryDevtoolsStringPreset,
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
import { MenuSearchDirective, MenuSurfaceDirective, MenuTriggerDirective } from '../menu/headless';
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
    MenuSearchDirective,
    MenuComponent,
    MenuItemComponent,
    MenuItemShortcutComponent,
    MenuSeparatorComponent,
    ProvideColorDirective,
  ],
})
export class QueryDevtoolsOverrideMenuComponent {
  protected errorColorTheme = injectErrorTheme();
  public value = input<unknown>();
  public path = input<JsonPath>([]);
  public parentKind = input<JsonKind | null>(null);
  public overrides = input.required<QueryDevtoolsOverridesRecorder>();

  private rootMenu = viewChild.required<MenuDirective>('rootMenu');
  private customInput = viewChild<ElementRef<HTMLInputElement>>('customValueInput');

  protected kind = computed(() => kindOf(this.value()));
  protected isContainer = computed(() => this.kind() === 'array' || this.kind() === 'object');
  protected isEmptyValue = computed(() => this.kind() === 'null' || this.kind() === 'undefined');
  protected hasArmedOverrides = computed(() => hasQueryDevtoolsOverridesAtPath(this.overrides().list(), this.path()));
  protected isArrayElement = computed(() => this.parentKind() === 'array' && this.kind() === 'object');
  protected paginationShape = computed(() => detectPaginationShape(this.value()));
  protected isDate = computed(() => {
    const path = this.path();
    return this.kind() === 'string' && isDateShapedLeaf(path[path.length - 1] ?? null, this.value());
  });

  protected customMode = signal(false);
  protected menuError = signal<string | null>(null);

  protected supportsCustomValue = computed(() => !this.isContainer() && this.kind() !== 'boolean');

  protected customPlaceholder = computed(() => {
    switch (this.kind()) {
      case 'number':
        return 'A number';
      case 'string':
        return 'Any text';
      default:
        return 'JSON or plain text';
    }
  });

  constructor() {
    injectStyleManager().mount(QueryDevtoolsOverrideMenuStylesComponent);

    effect(() => this.customInput()?.nativeElement.focus());
  }

  protected applyStringPreset(preset: 'short' | 'long' | 'longWord' | 'unicode') {
    this.overrides().arm({
      type: 'stringPreset',
      path: this.path(),
      preset,
      custom: generateQueryDevtoolsStringPreset(preset),
    });
  }

  protected applyNumberPreset(preset: 'zero' | 'negative' | 'huge') {
    this.overrides().arm({
      type: 'numberPreset',
      path: this.path(),
      preset,
      custom: generateQueryDevtoolsNumberPreset(preset),
    });
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

  protected fillStrings(preset: 'short' | 'long' | 'longWord' | 'unicode') {
    for (const leaf of collectLeafPaths(this.value(), 'string')) {
      this.overrides().arm({
        type: 'stringPreset',
        path: [...this.path(), ...leaf],
        preset,
        custom: generateQueryDevtoolsStringPreset(preset),
      });
    }
  }

  protected fillNumbers(preset: 'zero' | 'negative' | 'huge') {
    for (const leaf of collectLeafPaths(this.value(), 'number')) {
      this.overrides().arm({
        type: 'numberPreset',
        path: [...this.path(), ...leaf],
        preset,
        custom: generateQueryDevtoolsNumberPreset(preset),
      });
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

  protected startCustomEdit() {
    this.menuError.set(null);
    this.customMode.set(true);
  }

  protected commitCustomValue() {
    const raw = this.customInput()?.nativeElement.value;
    if (raw === undefined) return;

    const kind = this.kind();

    if (kind === 'number') {
      const value = Number(raw.trim());

      if (!raw.trim() || Number.isNaN(value)) {
        this.menuError.set('Not a number');

        return;
      }

      this.overrides().arm({ type: 'numberPreset', path: this.path(), preset: 'custom', custom: value });
    } else if (kind === 'string') {
      this.overrides().arm({ type: 'stringPreset', path: this.path(), preset: 'custom', custom: raw });
    } else {
      this.overrides().arm({ type: 'set', path: this.path(), value: parseLooseJson(raw) });
    }

    this.rootMenu().closeAll();
  }

  protected pasteValue() {
    this.menuError.set(null);

    if (!navigator.clipboard?.readText) {
      this.menuError.set('Clipboard access is unavailable here');

      return;
    }

    navigator.clipboard.readText().then(
      (text) => this.armPastedText(text),
      () => this.menuError.set('The clipboard read was blocked'),
    );
  }

  protected resetEditingState(open: boolean) {
    if (!open) {
      this.customMode.set(false);
      this.menuError.set(null);
    }
  }

  private armPastedText(text: string) {
    if (!text.trim()) {
      this.menuError.set('The clipboard is empty');

      return;
    }

    let value: unknown;

    try {
      value = JSON.parse(text);
    } catch {
      if (this.isContainer()) {
        this.menuError.set('The clipboard does not hold valid JSON');

        return;
      }

      value = text;
    }

    if (this.isContainer() && kindOf(value) !== this.kind()) {
      this.menuError.set(`The clipboard holds ${kindOf(value)}, not ${this.kind()}`);

      return;
    }

    this.overrides().arm({ type: 'set', path: this.path(), value });
    this.rootMenu().closeAll();
  }
}

const parseLooseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};
