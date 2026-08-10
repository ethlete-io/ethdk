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
import { readQueryDevtoolsClipboard, textFromQueryDevtoolsPaste } from './query-devtools-clipboard';
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
  private pasteInput = viewChild<ElementRef<HTMLInputElement>>('pasteBox');

  protected kind = computed(() => kindOf(this.value()));
  protected isContainer = computed(() => this.kind() === 'array' || this.kind() === 'object');
  protected isEmptyValue = computed(() => this.kind() === 'null' || this.kind() === 'undefined');
  protected hasArmedOverrides = computed(() => hasQueryDevtoolsOverridesAtPath(this.overrides().list(), this.path()));
  protected isArrayElement = computed(() => this.parentKind() === 'array' && this.kind() === 'object');
  protected paginationShape = computed(() => detectPaginationShape(this.value()));

  /** Whether this node sits inside a container it can be removed from - the root does not. */
  protected isRemovable = computed(() => this.path().length > 0);
  protected isInArray = computed(() => this.parentKind() === 'array');
  protected hasArrayItems = computed(() => {
    const value = this.value();
    return Array.isArray(value) && value.length > 0;
  });
  protected supportsNull = computed(() => !this.isEmptyValue());

  protected isDate = computed(() => {
    const path = this.path();
    return this.kind() === 'string' && isDateShapedLeaf(path[path.length - 1] ?? null, this.value());
  });

  protected customMode = signal(false);
  protected pasteMode = signal(false);
  private pasteTarget = signal<PasteTarget>('value');
  protected pendingPaste = signal<{ value: unknown; kind: JsonKind } | null>(null);
  protected menuError = signal<string | null>(null);
  protected menuNote = signal<string | null>(null);

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
    effect(() => this.pasteInput()?.nativeElement.focus());
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

  protected emptyArray() {
    this.overrides().arm({ type: 'set', path: this.path(), value: [] });
  }

  protected deleteThis() {
    this.overrides().arm({ type: 'deleteAt', path: this.path() });
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
    this.startPaste('value');
  }

  protected pasteArrayItem() {
    this.startPaste('arrayItem');
  }

  protected pasteIntoBox(event: ClipboardEvent) {
    const text = textFromQueryDevtoolsPaste(event);
    if (!text) return;

    event.preventDefault();
    this.armPastedText(text);
  }

  protected commitPasteBox() {
    const raw = this.pasteInput()?.nativeElement.value;

    if (raw !== undefined) this.armPastedText(raw);
  }

  /** Arms the paste the kind guard stopped, now that the menu has said what it replaces. */
  protected confirmKindChange() {
    const pending = this.pendingPaste();
    if (!pending) return;

    this.pendingPaste.set(null);
    this.armValue(pending.value);
  }

  protected cancelKindChange() {
    this.pendingPaste.set(null);
  }

  protected resetEditingState(open: boolean) {
    if (!open) {
      this.customMode.set(false);
      this.pasteMode.set(false);
      this.pasteTarget.set('value');
      this.pendingPaste.set(null);
      this.menuError.set(null);
      this.menuNote.set(null);
    }
  }

  private startPaste(target: PasteTarget) {
    this.menuError.set(null);
    this.menuNote.set(null);
    this.pendingPaste.set(null);
    this.pasteTarget.set(target);

    readQueryDevtoolsClipboard().then((read) => {
      if (read.ok) {
        this.armPastedText(read.text);

        return;
      }

      this.pasteMode.set(true);
      this.menuNote.set(
        read.reason === 'unavailable'
          ? 'This browser will not hand over the clipboard - press ⌘V / Ctrl+V here instead.'
          : 'The clipboard read was blocked - press ⌘V / Ctrl+V here instead.',
      );
    });
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
      if (this.pasteTarget() === 'value' && this.isContainer()) {
        this.menuError.set('The clipboard does not hold valid JSON');

        return;
      }

      value = text;
    }

    if (this.pasteTarget() === 'arrayItem') {
      this.armValue(value);

      return;
    }

    const pastedKind = kindOf(value);

    // The guard catches a copied *path* pasted over a body; "this field became an array" is worth
    // rehearsing, so it asks rather than refuses.
    if (pastedKind !== this.kind()) {
      this.pasteMode.set(false);
      this.menuError.set(null);
      this.menuNote.set(null);
      this.pendingPaste.set({ value, kind: pastedKind });

      return;
    }

    this.armValue(value);
  }

  private armValue(value: unknown) {
    if (this.pasteTarget() === 'arrayItem') this.overrides().arm({ type: 'pasteArrayItem', path: this.path(), value });
    else this.overrides().arm({ type: 'set', path: this.path(), value });

    this.rootMenu().closeAll();
  }
}

/** Whether a paste replaces the node itself or lands as a new element inside it. */
type PasteTarget = 'value' | 'arrayItem';

const parseLooseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};
