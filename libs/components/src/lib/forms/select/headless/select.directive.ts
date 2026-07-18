import {
  DOCUMENT,
  DestroyRef,
  Directive,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  inputBinding,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { RuntimeError, nextFrame } from '@ethlete/core';
import { EMPTY, fromEvent, switchMap, tap } from 'rxjs';
import { sortByDomOrder } from '../../../internals/dom-order';
import { createTypeahead } from '../../../internals/typeahead';
import { anchoredOverlayStrategy } from '../../../overlay/strategies';
import {
  AnchoredPanelOverlayRef,
  createAnchoredPanelController,
  FORM_FIELD_CONTROL_TYPES,
  FORM_FIELD_TOKEN,
  FormFieldControl,
  isInteractiveElement,
} from '../../form-field/headless';
import { createSelectionState } from '../../selection-list/headless/internals/selection-state';
import { SELECT_ERROR_CODES } from '../select-errors';
import { SelectListboxDirective } from './select-listbox.directive';
import { SelectSearchDirective } from './select-search.directive';
import { SelectEmptyDirective, SelectErrorDirective, SelectLoadingDirective } from './select-state-templates.directive';
import { SelectSurfaceContext, SelectSurfaceDirective } from './select-surface.directive';
import { SelectTriggerDirective } from './select-trigger.directive';
import { SelectValueDirective } from './select-value.directive';
import { SelectItem, SelectSelectedEntry } from './select.tokens';

export const SELECT_FILTER_MODES = {
  /** The select never filters — a search input is purely informational for the consumer. */
  NONE: 'none',
  /** Non-matching registered options are hidden while a search query is set (client-side data). */
  INTERNAL: 'internal',
  /** The consumer reacts to `queryChange` (drives an `@for` / a query); the select hides nothing. */
  EXTERNAL: 'external',
} as const;

export type SelectFilterMode = (typeof SELECT_FILTER_MODES)[keyof typeof SELECT_FILTER_MODES];

const defaultNormalizeCustomValue = (raw: string) => {
  const trimmed = raw.trim();

  return trimmed.length ? trimmed : null;
};

@Directive({
  selector: '[etSelect]',
  exportAs: 'etSelect',
  host: {
    '[attr.data-select-open]': 'open() || null',
  },
})
export class SelectDirective implements FormValueControl<unknown>, FormFieldControl {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);

  public value = model<unknown | unknown[] | null>(null);
  public touched = model(false);
  public open = model(false);
  public multiple = input(false);
  public disabled = input(false);
  public readonly = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');
  public placeholder = input('');

  public filterMode = input<SelectFilterMode>(SELECT_FILTER_MODES.INTERNAL);
  /** Enter with a search query that matches no option commits the raw query string as the value. */
  public allowCustomValues = input(false);
  /**
   * Single characters that commit the pending search query as a custom value the moment they
   * are typed (e.g. `[',']`), and split pasted text in multi mode. Only with `allowCustomValues`.
   */
  public customValueSeparators = input<string[]>([]);
  /** Maps raw text to the stored custom value — return `null` to reject. Defaults to trimming. */
  public normalizeCustomValue = input<(raw: string) => string | null>(defaultNormalizeCustomValue);
  /**
   * Commits a pending search query as a custom value when the panel closes (Tab, outside
   * click) instead of discarding it. An Escape close never commits — it clears the query first.
   */
  public commitCustomValueOnClose = input(false);
  /** Maximum number of selected values (multi select) — further adds are ignored. */
  public maxSelection = input<number | undefined>(undefined);
  /** Renders an "Add new" row in `et-select`'s panel — clicking it emits `addNewRequested`. */
  public allowAddNew = input(false);
  /** Async option state — rendered by `et-select` as a loading row inside the panel. */
  public loading = input(false);
  /** Async option state — rendered by `et-select` as an error row inside the panel. */
  public error = input<string | null>(null);
  /** Async option state — `et-select` renders a load-more control emitting `loadMoreRequested`. */
  public hasMoreItems = input(false);
  /** Whether the panel mirrors the anchor's width. Off for compact triggers (e.g. a country picker). */
  public mirrorPanelWidth = input(true);

  public queryChange = output<string>();
  public loadMoreRequested = output<void>();
  /** The user picked the "Add new" row (`allowAddNew`). Emits the current search query for prefilling. */
  public addNewRequested = output<string>();

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  public hasValue = computed(() => {
    const value = this.value();

    return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;
  });

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SELECT);

  /** @internal Set by the trigger. The field also counts as focused while the panel is open (focus may sit in the search input). */
  public triggerFocused = signal(false);
  public focused = computed(() => this.triggerFocused() || this.open());

  public labelId = computed(() => this.formField?.registeredLabel()?.id() ?? null);

  /** @internal */
  public registeredTrigger = signal<SelectTriggerDirective | null>(null);
  /** @internal */
  public registeredSurface = signal<SelectSurfaceDirective | null>(null);
  /** @internal */
  public registeredListbox = signal<SelectListboxDirective | null>(null);
  /** @internal */
  public registeredValueTemplate = signal<SelectValueDirective | null>(null);
  /** @internal */
  public registeredSearch = signal<SelectSearchDirective | null>(null);
  /** @internal */
  public registeredLoadingTemplate = signal<SelectLoadingDirective | null>(null);
  /** @internal */
  public registeredErrorTemplate = signal<SelectErrorDirective | null>(null);
  /** @internal */
  public registeredEmptyTemplate = signal<SelectEmptyDirective | null>(null);
  /** @internal The option that holds virtual focus while the listbox is open. */
  public activeItem = signal<SelectItem | null>(null);
  /**
   * @internal How the current active item was set. A pointer-set highlight only paints while
   * the pointer is actually over the option (mirrors the menu, where leaving the list drops
   * the highlight) — a keyboard-set one must stay visible without hover, because options
   * only ever hold virtual focus.
   */
  public activeItemSource = signal<'keyboard' | 'pointer'>('keyboard');

  public selection = createSelectionState<unknown, SelectItem>({
    value: this.value,
    multiple: this.multiple,
    disabled: this.disabled,
  });

  public activeId = computed(() => this.activeItem()?.id() ?? null);
  public listboxId = computed(() => this.registeredListbox()?.id ?? null);

  /** @internal */
  public overlayRef = signal<AnchoredPanelOverlayRef | null>(null);
  public isMounted = computed(() => this.overlayRef() !== null);

  private panel = createAnchoredPanelController({
    canOpen: computed(() => !this.disabled()),
    open: this.open,
    overlayRef: this.overlayRef,
    surface: this.registeredSurface,
    anchor: () => this.resolveAnchorElement(),
    config: ({ origin }) => {
      const context: SelectSurfaceContext = { $implicit: this, select: this, close: () => this.hide() };

      return {
        bindings: [
          inputBinding('template', () => this.registeredSurface()?.templateRef),
          inputBinding('context', () => context),
        ],
        mode: 'non-modal',
        hasBackdrop: false,
        // combobox pattern: DOM focus stays on the trigger (or moves into the search input),
        // options only get virtual focus
        autoFocus: false,
        restoreFocus: false,
        // both interactive closes are owned by the document-level listeners below: the first
        // Escape only clears a search query, and a pointerdown inside the field (e.g. the
        // inline search input) must not close — the runtime's handlers cannot know either
        closeOnEscape: false,
        closeOnOutsidePointer: false,
        origin,
        panelClass: 'et-select-overlay-pane',
        // anchored at every breakpoint by design (the cascader swaps to a bottom sheet below `md`):
        // a select is a single-column listbox that reads fine anchored to the field on mobile, while
        // the cascader's multi-column drill genuinely needs the sheet's full-width column paging
        strategies: anchoredOverlayStrategy({
          containerClass: ['et-overlay--anchored', 'et-overlay--select'],
          placement: 'bottom-start',
          fallbackPlacements: ['top-start'],
          offset: 4,
          viewportPadding: 8,
          autoResize: true,
          shift: { crossAxis: true },
          mirrorWidth: this.mirrorPanelWidth(),
        }),
      };
    },
    onMounted: (overlayRef) => this.handlePanelMounted(overlayRef),
    onBeforeClosed: () => this.handlePanelBeforeClosed(),
    onAfterClosed: ({ byOutsidePointer }) => {
      // focus that sat inside the pane fell to <body> with the pane's removal — hand it
      // back to the field, except for outside closes (the user deliberately went elsewhere)
      if (!byOutsidePointer && this.document.activeElement === this.document.body) {
        this.activate();
      }
    },
    onDocumentKeydown: (event) => this.handlePanelKeydown(event),
  });

  public sortedItems = computed(() => {
    const items = this.selection.items();

    // re-evaluate when the panel mounts — that's when the options gain document positions
    this.isMounted();

    // detached options (closed select with projected content) have no meaningful document
    // position, and comparing them yields arbitrary order — keep registration order instead
    if (items.some((item) => !item.elementRef.nativeElement.isConnected)) {
      return items;
    }

    return sortByDomOrder(items, (item) => item.elementRef.nativeElement);
  });
  /** The current search query (empty string when no search is registered). */
  public query = computed(() => this.registeredSearch()?.query() ?? '');

  /** @internal Lower-cased query for option matching. */
  public normalizedQuery = computed(() => this.query().trim().toLowerCase());

  /**
   * @internal The query the panel filters by. Live while open; frozen at its last value
   * otherwise — the close-time query clear must not unfilter the options while the panel
   * is still animating out (the content would visibly resize mid-leave).
   */
  public panelFilterQuery = linkedSignal<{ open: boolean; query: string }, string>({
    source: () => ({ open: this.open(), query: this.normalizedQuery() }),
    computation: (source, previous) => (source.open || previous === undefined ? source.query : previous.value),
  });

  /** The options the panel currently shows — with `filterMode` `internal`, non-matching ones are excluded. */
  public visibleItems = computed(() => {
    const items = this.sortedItems();

    if (this.filterMode() !== SELECT_FILTER_MODES.INTERNAL) {
      return items;
    }

    const query = this.panelFilterQuery();

    if (!query) {
      return items;
    }

    return items.filter((item) => item.label().toLowerCase().includes(query));
  });

  public enabledItems = computed(() => this.visibleItems().filter((item) => !item.disabled()));
  public selectedItems = computed(() => this.sortedItems().filter((item) => item.checked()));

  /** True once `maxSelection` is reached (multi select) — further adds are ignored. */
  public isFull = computed(() => {
    const maxSelection = this.maxSelection();

    if (maxSelection === undefined || !this.multiple()) {
      return false;
    }

    const value = this.value();

    return Array.isArray(value) && value.length >= maxSelection;
  });

  /**
   * The normalized custom value the current search query would commit, or `null` when there
   * is nothing to commit: custom values are off, the query is empty/rejected, the value is
   * already selected, a visible option carries the same label, or the selection is full.
   * `et-select` renders this as a "Create …" listbox row (a real option, so it takes part in
   * virtual focus) — headless consumers render their own row, marked with `customValueOption`
   * so it is excluded from the duplicate check here.
   */
  public customValueCandidate = computed(() => {
    if (!this.allowCustomValues() || this.disabled() || this.readonly() || this.isFull()) {
      return null;
    }

    const candidate = this.normalizeCustomValue()(this.query());

    if (candidate === null) {
      return null;
    }

    const value = this.value();
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];

    if (values.includes(candidate)) {
      return null;
    }

    const loweredCandidate = candidate.toLowerCase();
    const duplicatesOption = this.visibleItems().some(
      (item) => !item.custom?.() && item.label().toLowerCase() === loweredCandidate,
    );

    return duplicatesOption ? null : candidate;
  });

  // options render lazily inside the surface template, so a value's label must survive
  // the options unmounting for the trigger to keep displaying it while closed
  private labelCache = signal(new Map<unknown, string>());

  /**
   * One entry per selected value, resolved for display: the label comes from the live
   * option, from a previously seen option, or — for string values without any option
   * (custom values) — from the value itself. `item` is `null` when no live option
   * carries the value. Drives the trigger's chips and label display.
   */
  public selectedEntries = computed<SelectSelectedEntry[]>(() => {
    const value = this.value();
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    const items = this.sortedItems();
    const cache = this.labelCache();

    return values.map((entryValue) => {
      const item = items.find((candidate) => candidate.value() === entryValue) ?? null;
      const label = item?.label() || cache.get(entryValue) || (typeof entryValue === 'string' ? entryValue : null);

      return { value: entryValue, label, item };
    });
  });

  /**
   * The label(s) of the current value for trigger display. `null` when no label is
   * known (show the placeholder).
   */
  public displayValue = computed(() => {
    const labels = this.selectedEntries()
      .map((entry) => entry.label)
      .filter((label): label is string => label !== null);

    return labels.length ? labels.join(', ') : null;
  });

  private typeahead = createTypeahead();

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    // cache labels only for the *selected* values (so the trigger can still show them once the
    // option unmounts in a lazy/async list) and prune everything else — the old version wrote
    // every option ever registered and never pruned, so an `external` filter churning through
    // thousands of options grew the map without bound
    effect(() => {
      const value = this.value();
      const selectedValues = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
      const items = this.selection.items();

      // tracked read: a selected option's label may resolve after it registers
      const liveLabels = new Map<unknown, string>();

      for (const item of items) {
        const itemValue = item.value();

        if (selectedValues.includes(itemValue)) {
          liveLabels.set(itemValue, item.label());
        }
      }

      untracked(() => {
        this.labelCache.update((cache) => {
          const next = new Map<unknown, string>();

          for (const selectedValue of selectedValues) {
            const label = liveLabels.get(selectedValue) ?? cache.get(selectedValue);

            if (label !== undefined) {
              next.set(selectedValue, label);
            }
          }

          return next;
        });
      });
    });

    // a query change can filter the active option away (or, with external filtering,
    // destroy and recreate the option list entirely) — virtual focus falls back to the
    // first visible option so arrow keys and Enter keep working mid-search. Initializing
    // from null prefers the selected option, same as the mount-time initial focus.
    effect(() => {
      const enabled = this.enabledItems();
      const isOpen = this.open();

      untracked(() => {
        if (!isOpen) {
          return;
        }

        const active = this.activeItem();

        if (active && enabled.includes(active)) {
          return;
        }

        const next =
          (!active ? this.selectedItems().find((item) => enabled.includes(item)) : null) ?? enabled[0] ?? null;

        if (next) {
          this.setActiveItem(next, { scroll: !active });
        } else {
          this.activeItem.set(null);
        }
      });
    });

    // inside a form field the visible box is the field's control frame, which extends beyond
    // the trigger (padding, prefix/suffix areas) — a click anywhere on it should open the
    // panel like a click on the trigger itself, instead of only focusing the control
    toObservable(computed(() => this.formField?.controlFrameElement() ?? null))
      .pipe(
        switchMap((frame) => (frame ? fromEvent<MouseEvent>(frame, 'click') : EMPTY)),
        tap((event) => this.handleFrameClick(event)),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.destroyRef.onDestroy(() => {
      this.typeahead.destroy();
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.registeredTrigger()) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.MISSING_TRIGGER,
            '[SelectDirective] Select trigger not found. Add an element with etSelectTrigger inside the [etSelect] element.',
          );
        }

        if (!this.registeredSurface()) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.MISSING_SURFACE,
            '[SelectDirective] Select surface not found. Add <ng-template etSelectSurface> inside the [etSelect] element.',
          );
        }
      });
    }
  }

  public show() {
    if (this.disabled() || this.readonly() || this.open()) {
      return;
    }

    this.open.set(true);
  }

  public hide() {
    if (this.open()) {
      this.open.set(false);
    } else {
      this.panel.close();
    }
  }

  public toggle() {
    if (this.open()) {
      this.hide();
    } else {
      this.show();
    }
  }

  public activate() {
    if (this.disabled()) {
      return;
    }

    const search = this.registeredSearch();

    if (search) {
      search.focus();

      return;
    }

    this.registeredTrigger()?.elementRef.nativeElement.focus({ preventScroll: true });
  }

  /** @internal Commits an option as the (or a) selected value. Single select closes afterwards. */
  public commitOption(item: SelectItem) {
    if (this.disabled() || this.readonly() || item.disabled()) {
      return;
    }

    if (this.multiple()) {
      // toggle by value arithmetic instead of the registry (`selection.select` recomputes the
      // array from registered options only, silently dropping values without a live option —
      // custom values, or options an external filter removed)
      const itemValue = item.value();
      const current = this.value();
      const values = Array.isArray(current) ? current : [];
      const adding = !values.includes(itemValue);

      if (adding && this.isFull()) {
        return;
      }

      this.value.set(adding ? [...values, itemValue] : values.filter((candidate) => candidate !== itemValue));

      // adding while searching: clear the query so the full list is back for the next pick
      // (toggling off keeps it — the user may be pruning several filtered values)
      if (adding) {
        this.registeredSearch()?.clear();
      }
    } else {
      this.selection.select(item);
      // cleared before the close so a `commitCustomValueOnClose` close cannot re-commit
      // the leftover query over the just-picked option
      this.registeredSearch()?.clear();
      this.hide();
    }
  }

  /** @internal Emits `loadMoreRequested` — wired to the panel's load-more control. */
  public requestLoadMore() {
    if (this.loading()) {
      return;
    }

    this.loadMoreRequested.emit();
  }

  /**
   * Emits `addNewRequested` with the current search query and closes the panel — wired to
   * the panel's "Add new" row (`allowAddNew`). The consumer reacts by e.g. opening a
   * creation dialog and, once the new option exists, setting it as the value.
   */
  public requestAddNew() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    this.addNewRequested.emit(this.query().trim());
    // the query was handed off — it must not double as a custom value when the close commits
    this.registeredSearch()?.clear();
    this.hide();
  }

  /** Deselects a selected option (multi select) — e.g. from a chip's remove button. */
  public deselectOption(item: SelectItem) {
    if (item.disabled() || !item.checked()) {
      return;
    }

    this.deselectValue(item.value());
  }

  /** Clears the entire selection and any search query — wired to `et-select`'s clear button. */
  public clearValue() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    this.value.set(this.multiple() ? [] : null);

    const search = this.registeredSearch();

    if (search && this.query()) {
      search.clear();
    }
  }

  /** Deselects by value — covers selected values without a live option (e.g. custom values). */
  public deselectValue(value: unknown) {
    if (this.disabled() || this.readonly()) {
      return;
    }

    const entry = this.selectedEntries().find((candidate) => candidate.value === value);

    if (entry?.item && entry.item.disabled()) {
      return;
    }

    if (this.multiple()) {
      const current = this.value();
      const values = Array.isArray(current) ? current : [];

      this.value.set(values.filter((candidate) => candidate !== value));
    } else {
      this.value.set(null);
    }
  }

  /** @internal */
  public setActiveItem(item: SelectItem, options?: { scroll?: boolean; source?: 'keyboard' | 'pointer' }) {
    this.activeItem.set(item);
    this.activeItemSource.set(options?.source ?? 'keyboard');

    if (options?.scroll !== false) {
      item.elementRef.nativeElement.scrollIntoView?.({ block: 'nearest' });
    }
  }

  /** @internal Keyboard input arrives on the trigger — DOM focus never enters the listbox. */
  public handleTriggerKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (!this.open()) {
      this.handleClosedKeydown(event);

      return;
    }

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        this.moveActive(1);

        return;
      }
      case 'ArrowUp': {
        event.preventDefault();
        this.moveActive(-1);

        return;
      }
      case 'Home': {
        event.preventDefault();
        this.setActiveToEdge('first');

        return;
      }
      case 'End': {
        event.preventDefault();
        this.setActiveToEdge('last');

        return;
      }
      case ' ': {
        // Space types into a focused search input instead of committing
        if (this.registeredSearch()?.isFocused()) {
          return;
        }

        event.preventDefault();
        this.commitActiveOrClose();

        return;
      }
      case 'Enter': {
        event.preventDefault();
        this.commitActiveOrClose();

        return;
      }
      case 'Tab': {
        // no preventDefault — focus moves on naturally, the popup just closes
        this.hide();

        return;
      }
      case 'Escape': {
        // handled centrally by the document-level escape listener (clear query, then close)
        return;
      }
      default: {
        if (event.key.length !== 1 || this.registeredSearch()?.isFocused()) {
          return;
        }

        const match = this.findTypeaheadMatch(event.key);

        if (match) {
          this.setActiveItem(match);
        }

        return;
      }
    }
  }

  /**
   * Commits raw text as a custom value: normalized via `normalizeCustomValue`, appended in
   * multi mode (duplicates and adds beyond `maxSelection` are rejected), set and closed in
   * single mode. Returns whether the value was committed.
   */
  public commitCustomValue(raw: string) {
    const committed = this.applyCustomValue(raw);

    if (committed && !this.multiple()) {
      this.hide();
    }

    return committed;
  }

  private handleClosedKeydown(event: KeyboardEvent) {
    const searchFocused = this.registeredSearch()?.isFocused() ?? false;

    switch (event.key) {
      case 'Enter':
      case ' ': {
        // native editing in the search input (Space types, Enter may submit the form)
        if (searchFocused) {
          return;
        }

        event.preventDefault();
        this.show();

        return;
      }
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        this.show();

        return;
      }
      default: {
        if (event.key.length !== 1 || searchFocused) {
          return;
        }

        // closed typeahead commits directly, like a native <select>
        const match = this.findTypeaheadMatch(event.key);

        if (match) {
          event.preventDefault();
          this.commitOptionWhileClosed(match);
        }

        return;
      }
    }
  }

  private commitActiveOrClose() {
    const item = this.activeItem();

    if (item) {
      this.commitOption(item);

      return;
    }

    if (this.allowCustomValues() && this.commitCustomValue(this.query())) {
      return;
    }

    this.hide();
  }

  // the value write shared by `commitCustomValue` and the close-time commit — the latter
  // must not call `hide()` while the panel is already closing
  private applyCustomValue(raw: string) {
    if (this.disabled() || this.readonly() || this.isFull()) {
      return false;
    }

    const value = this.normalizeCustomValue()(raw);

    if (value === null) {
      return false;
    }

    // the string is its own label — cache it so the trigger can display it
    this.labelCache.update((cache) => new Map(cache).set(value, value));

    if (this.multiple()) {
      const current = this.value();
      const values = Array.isArray(current) ? current : [];

      if (values.includes(value)) {
        return false;
      }

      this.value.set([...values, value]);
      this.registeredSearch()?.clear();
    } else {
      this.value.set(value);
    }

    return true;
  }

  private commitOptionWhileClosed(item: SelectItem) {
    if (this.disabled() || this.readonly() || item.disabled()) {
      return;
    }

    this.selection.select(item);
  }

  private findTypeaheadMatch(character: string) {
    const query = this.typeahead.append(character);

    return this.enabledItems().find((item) => item.label().toLowerCase().startsWith(query)) ?? null;
  }

  private moveActive(delta: 1 | -1) {
    const items = this.enabledItems();

    if (!items.length) {
      return;
    }

    const current = this.activeItem();
    const index = current ? items.indexOf(current) : -1;

    if (index === -1) {
      // first arrow press initializes virtual focus: the selected option, else an edge
      const target = this.selectedItems().find((item) => !item.disabled()) ?? null;

      if (target) {
        this.setActiveItem(target);
      } else {
        this.setActiveToEdge(delta === 1 ? 'first' : 'last');
      }

      return;
    }

    // deliberately no wrap — matches the ARIA select-only combobox pattern
    const next = items[index + delta];

    if (next) {
      this.setActiveItem(next);
    }
  }

  private setActiveToEdge(edge: 'first' | 'last') {
    const items = this.enabledItems();
    const target = edge === 'first' ? items[0] : items.at(-1);

    if (target) {
      this.setActiveItem(target);
    }
  }

  // inside a form field, the visible box is the field's control frame, not the trigger
  // button — anchor (and width-mirror) the panel to the frame so it lines up with the field
  private resolveAnchorElement() {
    return this.formField?.controlFrameElement() ?? this.registeredTrigger()?.elementRef.nativeElement;
  }

  private handleFrameClick(event: MouseEvent) {
    const target = event.target;
    const frame = event.currentTarget;

    if (!(target instanceof HTMLElement) || !(frame instanceof HTMLElement) || this.disabled() || this.readonly()) {
      return;
    }

    // the trigger (and everything inside it — chips, clear, chevron, inline search) already
    // handles its own clicks; clicks on (or inside) interactive affix content keep their
    // own behavior too
    if (this.registeredTrigger()?.elementRef.nativeElement.contains(target)) {
      return;
    }

    for (let element: HTMLElement | null = target; element && element !== frame; element = element.parentElement) {
      if (isInteractiveElement(element)) {
        return;
      }
    }

    const search = this.registeredSearch();

    if (search) {
      // same contract as a trigger click: the field click focuses the inline search input
      // and opens — only the chevron toggles closed
      this.show();
      search.focus();

      return;
    }

    this.registeredTrigger()?.elementRef.nativeElement.focus({ preventScroll: true });
    this.toggle();
  }

  // initial virtual focus: the selected option, else the first enabled one — unless a keydown
  // right after opening (before this frame) already moved the active item
  private handlePanelMounted(overlayRef: AnchoredPanelOverlayRef) {
    nextFrame(() => {
      if (this.overlayRef() !== overlayRef) {
        return;
      }

      // combobox pattern: DOM focus belongs in the search input while open (already
      // there when the open came from typing or a field click)
      const search = this.registeredSearch();

      if (search && !search.isFocused()) {
        search.focus();
      }

      // a displayed value label gets selected so typing replaces it
      search?.handleOpened();

      if (this.activeItem()) {
        return;
      }

      const target = this.selectedItems().find((item) => !item.disabled()) ?? this.enabledItems()[0] ?? null;

      if (target) {
        this.setActiveItem(target);
      }
    });
  }

  private handlePanelBeforeClosed() {
    this.activeItem.set(null);

    // pending text becomes a value instead of being discarded (tag-input's commit-on-blur).
    // An Escape close never reaches this with a query — Escape clears it first.
    if (this.allowCustomValues() && this.commitCustomValueOnClose()) {
      this.applyCustomValue(this.query());
    }

    // a stale query would silently keep filtering the next open — cleared at close-start so the
    // trigger's value display is correct during the leave animation
    const search = this.registeredSearch();

    if (search && this.query()) {
      search.clear();
    }
  }

  // Escape is handled here instead of by the overlay runtime: with a search input the first
  // Escape only clears the query (the runtime's capture-phase handler would close before the
  // input ever saw the key).
  private handlePanelKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }

    event.preventDefault();

    const search = this.registeredSearch();

    if (search && this.query()) {
      search.clear();

      return;
    }

    this.hide();
  }
}
