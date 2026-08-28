import {
  DOCUMENT,
  DestroyRef,
  Directive,
  Signal,
  WritableSignal,
  afterNextRender,
  booleanAttribute,
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
import {
  RuntimeError,
  createComponentId,
  injectHostElement,
  injectStyleManager,
  nextFrame,
  signalDeferredLoading,
} from '@ethlete/core';
import { EMPTY, fromEvent, switchMap, tap } from 'rxjs';
import { sortByDomOrder } from '../../../internals/dom-order';
import { createTypeahead } from '../../../internals/typeahead';
import { createVirtualWindow } from '../../../internals/virtual-window';
import { mountFloatingPanelStyles } from '../../../overlay/floating-panel-styles.component';
import { anchoredOverlayStrategy } from '../../../overlay/strategies';
import {
  AccessibleNameControlDirective,
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
import { SelectOptionTemplateDirective } from './select-option-template.directive';
import { SelectSearchDirective } from './select-search.directive';
import { SelectExtrasStylesComponent } from '../select-extras-styles.component';
import { SelectEmptyDirective, SelectErrorDirective, SelectLoadingDirective } from './select-state-templates.directive';
import { SelectSurfaceContext, SelectSurfaceDirective } from './select-surface.directive';
import { SelectTriggerDirective } from './select-trigger.directive';
import { SelectValueDirective } from './select-value.directive';
import { SelectViewportDirective } from './select-viewport.directive';
import { SelectItem, SelectOptionData, SelectSelectedEntry } from './select.tokens';
import { injectFormFieldLabels } from '../../../forms/form-field/form-field-labels';
import { mountTextFieldShellStyles } from '../../form-field/form-field-text-shell-styles.component';

export const SELECT_FILTER_MODES = {
  /** The select never filters - a search input is purely informational for the consumer. */
  NONE: 'none',
  /** Non-matching registered options are hidden while a search query is set (client-side data). */
  INTERNAL: 'internal',
  /** The consumer reacts to `queryChange` (drives an `@for` / a query); the select hides nothing. */
  EXTERNAL: 'external',
} as const;

export type SelectFilterMode = (typeof SELECT_FILTER_MODES)[keyof typeof SELECT_FILTER_MODES];

// Above this many visible data-driven rows the select windows their rendering. Comfortably past
// what a panel shows at once (its default max height over the row estimate, plus overscan on
// both sides), so a list that windowing would render in full anyway stays unwindowed.
const VIRTUALIZATION_MIN_ITEMS = 40;

/**
 * The async option state a source (e.g. the bundle from `selectOptionsFromQuery`) pushes into a
 * select via `[etSelectOptions]`. While one is set it overrides the `loading`/`error`/`hasMoreItems`
 * inputs and forces `filterMode` to `external`. Structurally satisfied by `SelectOptionsFromQuery`.
 */
export type SelectAsyncOptions = {
  loading: Signal<boolean>;
  error: Signal<string | null>;
  hasMore: Signal<boolean>;
};

const defaultNormalizeCustomValue = (raw: string) => {
  const trimmed = raw.trim();

  return trimmed.length ? trimmed : null;
};

@Directive({
  selector: '[etSelect]',
  exportAs: 'etSelect',
  host: {
    '[attr.data-select-open]': 'open() || null',
    '[attr.data-mixed]': 'mixed() || null',
  },
})
export class SelectDirective
  extends AccessibleNameControlDirective
  implements FormValueControl<unknown>, FormFieldControl
{
  private formFieldLabels = injectFormFieldLabels();

  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private hostElement = injectHostElement();

  public value = model<unknown | unknown[] | null>(null);
  /** View state for a field whose source values disagree. The raw form value stays untouched. */
  public mixed = model(false);
  public touched = model(false);
  public open = model(false);
  public multiple = input(false, { transform: booleanAttribute });
  public disabled = input(false, { transform: booleanAttribute });
  public readonly = input(false, { transform: booleanAttribute });
  public invalid = input(false, { transform: booleanAttribute });
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false, { transform: booleanAttribute });
  public name = input('');
  public placeholder = input('');
  /** Trigger text shown while `mixed` is set. */
  public mixedLabel = input<string | null>(null);

  /**
   * Data-driven options: the select owns the option rows instead of the consumer projecting
   * `et-select-option`s. Long lists have their rendering windowed (virtualization) - only rows
   * near the viewport exist in the DOM, so lists with thousands of entries stay cheap; short
   * ones render in full. Renders via `virtualizedItems()` between the `virtualWindow` block
   * paddings; row content is the plain `label` or an `etSelectOptionTemplate`. Values must be
   * unique. Can be combined
   * with projected options (e.g. a pinned row), which render normally and are not windowed.
   */
  public options = input<readonly SelectOptionData[] | null>(null);

  public filterModeInput = input<SelectFilterMode>(SELECT_FILTER_MODES.INTERNAL, { alias: 'filterMode' });
  /** Enter with a search query that matches no option commits the raw query string as the value. */
  public allowCustomValues = input(false, { transform: booleanAttribute });
  /**
   * Single characters that commit the pending search query as a custom value the moment they
   * are typed (e.g. `[',']`), and split pasted text in multi mode. Only with `allowCustomValues`.
   */
  public customValueSeparators = input<string[]>([]);
  /** Maps raw text to the stored custom value - return `null` to reject. Defaults to trimming. */
  public normalizeCustomValue = input<(raw: string) => string | null>(defaultNormalizeCustomValue);
  /**
   * Commits a pending search query as a custom value when the panel closes (Tab, outside
   * click) instead of discarding it. An Escape close never commits - it clears the query first.
   */
  public commitCustomValueOnClose = input(false, { transform: booleanAttribute });
  /** Maximum number of selected values (multi select) - further adds are ignored. */
  public maxSelection = input<number | undefined>(undefined);
  /** Renders an "Add new" row in `et-select`'s panel - clicking it emits `addNew`. */
  public allowAddNew = input(false, { transform: booleanAttribute });
  /** Async option state - rendered by `et-select` as a loading row inside the panel. */
  public loadingInput = input(false, { alias: 'loading', transform: booleanAttribute });
  /** Async option state - rendered by `et-select` as an error row inside the panel. */
  public errorInput = input<string | null>(null, { alias: 'error' });
  /** Async option state - `et-select` renders a load-more control emitting `loadMore`. */
  public hasMoreItemsInput = input(false, { alias: 'hasMoreItems', transform: booleanAttribute });
  /** Whether the panel mirrors the anchor's width. Off for compact triggers (e.g. a country picker). */
  public mirrorPanelWidth = input(true, { transform: booleanAttribute });
  /**
   * Fire-and-forget picker mode: committing an option emits `pickOption` without ever writing
   * `value`, so the field never displays a value of its own (no chips, no label, no clear) and can
   * feed an external list without the set-then-clear dance. Bind `value` to that list to check the
   * picked options in the panel. Single select closes on pick; multi keeps the panel open for
   * repeated adds.
   */
  public pickOnly = input(false, { transform: booleanAttribute });

  public queryChange = output<string>();
  public loadMore = output<void>();
  /** The user picked the "Add new" row (`allowAddNew`). Emits the current search query for prefilling. */
  public addNew = output<string>();
  /**
   * A single select - or a `pickOnly` multi select - committed an option, carrying the picked
   * value. In `pickOnly` mode this is the only pick signal and `value` is never mutated;
   * otherwise it fires alongside the normal value selection.
   */
  public pickOption = output<unknown>();

  /** The string in effect: this instance's `mixedLabel`, else `FORM_FIELD_LABELS`. */
  public resolvedMixedLabel = computed(() => this.mixedLabel() ?? this.formFieldLabels().mixed);

  /**
   * An async option source pushed in by `[etSelectOptions]` (from `selectOptionsFromQuery` /
   * `selectOptionsFromV2Query`). While set it overrides the `loading`/`error`/`hasMoreItems`
   * inputs and forces `filterMode` to `external`. `null` when the select is wired manually.
   * @internal
   */
  public asyncOptions = signal<SelectAsyncOptions | null>(null);

  /** How a search query filters. Forced to `external` while an `[etSelectOptions]` source is set. */
  public filterMode = computed<SelectFilterMode>(() =>
    this.asyncOptions() ? SELECT_FILTER_MODES.EXTERNAL : this.filterModeInput(),
  );
  /** Async option state - rendered by `et-select` as a loading row. From `[etSelectOptions]` if set. */
  public loading = computed(() => this.asyncOptions()?.loading() ?? this.loadingInput());

  /**
   * `loading()`, held back so a request that resolves quickly never flashes an indicator. Drive what
   * the reader *sees* off this - the spinner, the busy bar - and geometry off `loading()`, so the
   * panel takes its final height from the first frame instead of growing into it.
   */
  public showLoadingIndicator = signalDeferredLoading(this.loading);
  /** Async option state - rendered by `et-select` as an error row. From `[etSelectOptions]` if set. */
  public error = computed(() => this.asyncOptions()?.error() ?? this.errorInput());
  /** Async option state - drives the load-more control. From `[etSelectOptions]` if set. */
  public hasMoreItems = computed(() => this.asyncOptions()?.hasMore() ?? this.hasMoreItemsInput());

  public shouldDisplayError = computed(() => this.touched() && this.invalid());

  /**
   * The raw value normalized to the selection the control currently exposes. Mixed has no effective
   * selection, and neither has a `pickOnly` picker - its `value` marks the picked options in the
   * panel without ever becoming the field's own display.
   */
  private effectiveValues = computed<readonly unknown[]>(() => {
    if (this.mixed() || this.pickOnly()) {
      return [];
    }

    const value = this.value();

    return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  });

  public hasValue = computed(() => this.mixed() || this.effectiveValues().length > 0);

  public describedBy = signal<string | null>(null);
  public controlType = signal(FORM_FIELD_CONTROL_TYPES.SELECT);

  /** @internal Set by the trigger. The field also counts as focused while the panel is open (focus may sit in the search input). */
  public triggerFocused = signal(false);
  public focused = computed(() => this.triggerFocused() || this.open());

  /** @internal Keeps the form field in its focused style while the panel is open. */
  public expanded = computed(() => this.open());

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
  /** @internal ID of the component-rendered mixed label, when present. */
  public mixedLabelId = signal<string | null>(null);
  /** @internal */
  public registeredLoadingTemplate = signal<SelectLoadingDirective | null>(null);
  /** @internal */
  public registeredErrorTemplate = signal<SelectErrorDirective | null>(null);
  /** @internal */
  public registeredEmptyTemplate = signal<SelectEmptyDirective | null>(null);
  /** @internal */
  public registeredOptionTemplate = signal<SelectOptionTemplateDirective | null>(null);
  /** @internal The scrollable viewport that data-driven rendering windows against. */
  public registeredViewport = signal<SelectViewportDirective | null>(null);
  /** @internal The option that holds virtual focus while the listbox is open. */
  public activeItem = signal<SelectItem | null>(null);
  /**
   * @internal How the current active item was set. A pointer-set highlight only paints while
   * the pointer is actually over the option (mirrors the menu, where leaving the list drops
   * the highlight) - a keyboard-set one must stay visible without hover, because options
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
        // inline search input) must not close - the runtime's handlers cannot know either
        closeOnEscape: false,
        closeOnOutsidePointer: false,
        origin,
        panelClass: 'et-select-overlay-pane',
        // anchored at every breakpoint by design (the cascader swaps to a bottom sheet below `md`):
        // a select is a single-column listbox that reads fine anchored to the field on mobile, while
        // the cascader's multi-column drill genuinely needs the sheet's full-width column paging
        strategies: anchoredOverlayStrategy({
          containerClass: [
            'et-overlay--anchored',
            'et-overlay--select',
            'et-floating-panel',
            // when the panel does not mirror the field width the pane is content-sized, so the
            // panel needs a max-inline-size guard; when it does mirror, the pane width already
            // pins the panel to the field and any cap would make wide fields stop matching
            ...(this.mirrorPanelWidth() ? [] : ['et-overlay--select-content-width']),
          ],
          placement: 'bottom-start',
          offset: 4,
          viewportPadding: 8,
          autoResize: true,
          minAvailableSpace: 160,
          mirrorWidth: this.mirrorPanelWidth(),
        }),
      };
    },
    onMounted: (overlayRef) => this.handlePanelMounted(overlayRef),
    onBeforeClosed: () => this.handlePanelBeforeClosed(),
    onAfterClosed: ({ byOutsidePointer }) => {
      // focus that sat inside the pane fell to <body> with the pane's removal - hand it
      // back to the field, except for outside closes (the user deliberately went elsewhere)
      if (!byOutsidePointer && this.document.activeElement === this.document.body) {
        this.activate();
      }
    },
    onDocumentKeydown: (event) => this.handlePanelKeydown(event),
  });

  // the registered items created from the `options` input, in data order. Registered like
  // projected options (value↔checked sync, labels, keyboard nav all work over the registry),
  // but only the rows inside the virtual window are ever rendered.
  private dataItems = signal<SelectItem[]>([]);
  private dataItemRegistry = new Map<
    unknown,
    {
      item: SelectItem;
      label: WritableSignal<string>;
      disabledInput: WritableSignal<boolean>;
      element: WritableSignal<HTMLElement | null>;
      data: WritableSignal<SelectOptionData>;
    }
  >();

  public sortedItems = computed(() => {
    const dataItems = this.dataItems();
    const projectedItems = this.selection.items().filter((item) => !item.data);

    // re-evaluate when the panel mounts - that's when the options gain document positions
    this.isMounted();

    // detached options (closed select with projected content) have no meaningful document
    // position, and comparing them yields arbitrary order - keep registration order instead.
    // Data-driven items always keep their data order and sort before projected ones (which
    // render after the windowed rows, e.g. the "Create …" row).
    if (projectedItems.some((item) => !item.element()?.isConnected)) {
      return dataItems.length ? [...dataItems, ...projectedItems] : projectedItems;
    }

    const sortedProjected = sortByDomOrder(projectedItems, (item) => item.element() as HTMLElement);

    return dataItems.length ? [...dataItems, ...sortedProjected] : sortedProjected;
  });
  /** The current search query (empty string when no search is registered). */
  public query = computed(() => this.registeredSearch()?.query() ?? '');

  /** @internal Lower-cased query for option matching. */
  public normalizedQuery = computed(() => this.query().trim().toLowerCase());

  /**
   * Whether the request in flight is the next page the reader asked for, rather than a refetch of the
   * list itself. `et-select` reports the two differently: a load-more turns the control the reader
   * just clicked into a loading row, everything else runs a busy bar over the options.
   *
   * Set by `requestLoadMore()` and cleared as soon as `loading()` drops or the query moves on.
   */
  public loadingMore = linkedSignal<{ loading: boolean; query: string }, boolean>({
    source: () => ({ loading: this.loading(), query: this.normalizedQuery() }),
    computation: (source, previous) =>
      source.loading && source.query === previous?.source.query && (previous?.value ?? false),
  });

  /**
   * @internal The query the panel filters by. Live while open; frozen at its last value
   * otherwise - the close-time query clear must not unfilter the options while the panel
   * is still animating out (the content would visibly resize mid-leave).
   */
  public panelFilterQuery = linkedSignal<{ open: boolean; query: string }, string>({
    source: () => ({ open: this.open(), query: this.normalizedQuery() }),
    computation: (source, previous) => (source.open || previous === undefined ? source.query : previous.value),
  });

  /** The options the panel currently shows - with `filterMode` `internal`, non-matching ones are excluded. */
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
  public selectedItems = computed(() => (this.mixed() ? [] : this.sortedItems().filter((item) => item.checked())));

  /** @internal The query-visible slice of data-driven options - the virtual window renders these. */
  public visibleDataItems = computed(() => this.visibleItems().filter((item) => !!item.data));

  /**
   * @internal Whether the data-driven rows are windowed. A list that stays near a panel's
   * worth of rows renders in full: windowing it would render all of them anyway (viewport
   * plus overscan) while still costing a scroll listener, per-row mount churn and the
   * viewport's width floor.
   */
  public windowsOptions = computed(() => this.visibleDataItems().length > VIRTUALIZATION_MIN_ITEMS);

  /**
   * The window over the data-driven rows: `paddingTop()`/`paddingBottom()` stand in for the
   * scroll height of everything outside `virtualizedItems()` - apply them as block paddings
   * around the rendered rows.
   */
  public virtualWindow = createVirtualWindow({
    // only meaningful with enough data-driven options - otherwise don't track the viewport at all
    container: computed(() =>
      this.windowsOptions() ? (this.registeredViewport()?.elementRef.nativeElement ?? null) : null,
    ),
    itemCount: computed(() => this.visibleDataItems().length),
    estimateItemHeight: 36,
    overscan: 5,
  });

  /**
   * The windowed slice of data-driven options to render - every visible one while the list is
   * short enough to render in full or no `etSelectViewport` is registered. Render with
   * `etSelectVirtualOption` rows between the `virtualWindow` block paddings.
   */
  public virtualizedItems = computed(() => {
    const items = this.visibleDataItems();
    const { start, end } = this.virtualWindow.range();

    return items.slice(start, end);
  });

  // the item whose row must align exactly once it renders: the estimate-based window scroll
  // can land a few px off (scroller padding, row heights differing from the estimate)
  private pendingActiveScrollItem: SelectItem | null = null;

  /** True once `maxSelection` is reached (multi select) - further adds are ignored. */
  public isFull = computed(() => {
    const maxSelection = this.maxSelection();

    if (maxSelection === undefined || !this.multiple()) {
      return false;
    }

    if (this.mixed()) {
      return this.effectiveValues().length >= maxSelection;
    }

    const value = this.value();

    return Array.isArray(value) && value.length >= maxSelection;
  });

  /**
   * The normalized custom value the current search query would commit, or `null` when there
   * is nothing to commit: custom values are off, the query is empty/rejected, the value is
   * already selected, a visible option carries the same label, or the selection is full.
   * `et-select` renders this as a "Create …" listbox row (a real option, so it takes part in
   * virtual focus) - headless consumers render their own row, marked with `customValueOption`
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

    const values = this.effectiveValues();

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
   * option, from a previously seen option, or - for string values without any option
   * (custom values) - from the value itself. `item` is `null` when no live option
   * carries the value. Drives the trigger's chips and label display.
   */
  public selectedEntries = computed<SelectSelectedEntry[]>(() => {
    if (this.mixed()) {
      return [];
    }

    const values = this.effectiveValues();
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
    if (this.mixed()) {
      return this.resolvedMixedLabel();
    }

    const labels = this.selectedEntries()
      .map((entry) => entry.label)
      .filter((label): label is string => label !== null);

    return labels.length ? labels.join(', ') : null;
  });

  private typeahead = createTypeahead();

  constructor() {
    super();

    mountTextFieldShellStyles();
    mountFloatingPanelStyles();

    const styleManager = injectStyleManager();
    let hasMountedExtrasStyles = false;

    // every render branch of et-select's panel-extras template must be covered here, or its row
    // paints unstyled - the empty row shows for any open select whose options are all filtered away
    effect(() => {
      if (
        hasMountedExtrasStyles ||
        !(
          this.loading() ||
          this.error() !== null ||
          this.hasMoreItems() ||
          this.allowAddNew() ||
          this.asyncOptions() !== null ||
          (this.open() && !this.visibleItems().length)
        )
      ) {
        return;
      }

      hasMountedExtrasStyles = true;
      styleManager.mount(SelectExtrasStylesComponent);
    });

    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    // reconcile the `options` data with the registered data items: reuse the item of a value
    // that stays (labels/disabled update in place), register new ones, unregister removed ones
    effect(() => {
      const optionsData = this.options();

      untracked(() => {
        const registry = this.dataItemRegistry;
        const nextItems: SelectItem[] = [];
        const seenValues = new Set<unknown>();

        for (const data of optionsData ?? []) {
          // a duplicate value cannot be represented as a distinct choice - skip it
          if (seenValues.has(data.value)) {
            continue;
          }

          seenValues.add(data.value);

          let entry = registry.get(data.value);

          if (entry) {
            entry.label.set(data.label);
            entry.disabledInput.set(data.disabled ?? false);
            entry.data.set(data);
          } else {
            entry = this.createDataItem(data);
            registry.set(data.value, entry);
            this.selection.registerItem(entry.item);
          }

          nextItems.push(entry.item);
        }

        for (const [value, entry] of registry) {
          if (seenValues.has(value)) {
            continue;
          }

          registry.delete(value);

          if (this.activeItem() === entry.item) {
            this.activeItem.set(null);
          }

          if (this.pendingActiveScrollItem === entry.item) {
            this.pendingActiveScrollItem = null;
          }

          this.selection.unregisterItem(entry.item);
        }

        this.dataItems.set(nextItems);
      });
    });

    // cache labels only for the *selected* values (so the trigger can still show them once the
    // option unmounts in a lazy/async list) and prune everything else - the old version wrote
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
    // destroy and recreate the option list entirely) - virtual focus falls back to the
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
    // the trigger (padding, prefix/suffix areas) - a click anywhere on it should open the
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
            { element: this.hostElement },
          );
        }

        if (!this.registeredSurface()) {
          throw new RuntimeError(
            SELECT_ERROR_CODES.MISSING_SURFACE,
            '[SelectDirective] Select surface not found. Add <ng-template etSelectSurface> inside the [etSelect] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  /** @internal Whether a value belongs to the effective selection (always false while mixed). */
  public isValueSelected(value: unknown) {
    if (this.mixed()) {
      return false;
    }

    const current = this.value();

    return Array.isArray(current) ? current.includes(value) : current === value;
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
    this.focus({ preventScroll: true });
  }

  public focus(options?: FocusOptions) {
    if (this.disabled()) {
      return;
    }

    const search = this.registeredSearch();

    if (search) {
      search.focus(options);

      return;
    }

    this.registeredTrigger()?.elementRef.nativeElement.focus(options);
  }

  /** @internal Commits an option as the (or a) selected value. Single select closes afterwards. */
  public commitOption(item: SelectItem) {
    if (this.disabled() || this.readonly() || item.disabled()) {
      return;
    }

    if (this.mixed()) {
      if (!this.commitMixedOption(item)) {
        return;
      }

      this.registeredSearch()?.clear();

      if (!this.multiple()) {
        this.hide();
      }

      return;
    }

    if (this.multiple()) {
      if (this.pickOnly()) {
        this.pickOption.emit(item.value());
        this.registeredSearch()?.clear();

        return;
      }

      // toggle by value arithmetic instead of the registry (`selection.select` recomputes the
      // array from registered options only, silently dropping values without a live option -
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
      // (toggling off keeps it - the user may be pruning several filtered values)
      if (adding) {
        this.registeredSearch()?.clear();
      }
    } else {
      this.pickSingleOption(item);
      // cleared before the close so a `commitCustomValueOnClose` close cannot re-commit
      // the leftover query over the just-picked option
      this.registeredSearch()?.clear();
      this.hide();
    }
  }

  /** @internal Emits `loadMore` - wired to the panel's load-more control. */
  public requestLoadMore() {
    if (this.loading()) {
      return;
    }

    // marked before the emit: the consumer may turn `loading` on synchronously from the handler,
    // and the flag has to be set by the time that lands or the panel reports the wrong wait
    this.loadingMore.set(true);
    this.loadMore.emit();
  }

  /**
   * Emits `addNew` with the current search query and closes the panel - wired to
   * the panel's "Add new" row (`allowAddNew`). The consumer reacts by e.g. opening a
   * creation dialog and, once the new option exists, setting it as the value.
   */
  public requestAddNew() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    this.addNew.emit(this.query().trim());
    // the query was handed off - it must not double as a custom value when the close commits
    this.registeredSearch()?.clear();
    this.hide();
  }

  /** Deselects a selected option (multi select) - e.g. from a chip's remove button. */
  public deselectOption(item: SelectItem) {
    if (item.disabled() || !item.checked()) {
      return;
    }

    this.deselectValue(item.value());
  }

  /** Clears the entire selection and any search query - wired to `et-select`'s clear button. */
  public clearValue() {
    if (this.disabled() || this.readonly()) {
      return;
    }

    this.value.set(this.multiple() ? [] : null);
    this.mixed.set(false);

    const search = this.registeredSearch();

    if (search && this.query()) {
      search.clear();
    }
  }

  /** Deselects by value - covers selected values without a live option (e.g. custom values). */
  public deselectValue(value: unknown) {
    if (this.disabled() || this.readonly()) {
      return;
    }

    if (this.mixed()) {
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
    this.pendingActiveScrollItem = null;

    if (options?.scroll === false) {
      return;
    }

    const element = item.element();

    if (element) {
      element.scrollIntoView?.({ block: 'nearest' });

      return;
    }

    // a data-driven option outside the rendered window - scroll its row into the window,
    // which renders it (and with it the element `aria-activedescendant` points at)
    const index = this.visibleDataItems().indexOf(item);

    if (index !== -1) {
      this.pendingActiveScrollItem = item;
      this.virtualWindow.scrollToIndex(index);
    }
  }

  /** @internal A rendered virtual row attaches its element to its item while it is windowed in. */
  public attachVirtualOptionElement(item: SelectItem, element: HTMLElement) {
    const entry = this.dataItemRegistry.get(item.value());

    if (!entry || entry.item !== item) {
      return;
    }

    entry.element.set(element);
    // rows share one uniform height - any rendered one keeps the window's row height honest
    this.virtualWindow.measureItem(element);

    // the window scroll above was estimate-based and can land a few px short - align the
    // real row exactly, once, now that it exists (never again on later window re-entries)
    if (this.pendingActiveScrollItem === item) {
      this.pendingActiveScrollItem = null;
      element.scrollIntoView?.({ block: 'nearest' });
    }
  }

  /** @internal */
  public detachVirtualOptionElement(item: SelectItem, element: HTMLElement) {
    const entry = this.dataItemRegistry.get(item.value());

    if (!entry || entry.item !== item || entry.element() !== element) {
      return;
    }

    entry.element.set(null);
  }

  /** @internal Keyboard input arrives on the trigger - DOM focus never enters the listbox. */
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
        // no preventDefault - focus moves on naturally, the popup just closes
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

  // single-select commit: fire the pick command, then write the value unless the select is a
  // fire-and-forget picker (`pickOnly`), in which case it stays valueless
  private pickSingleOption(item: SelectItem) {
    this.pickOption.emit(item.value());

    if (!this.pickOnly()) {
      this.selection.select(item);
    }
  }

  /** Writes the first explicit choice over a mixed value without consulting raw checked state. */
  private commitMixedOption(item: SelectItem) {
    if (this.isFull()) {
      return false;
    }

    this.value.set(this.multiple() ? [item.value()] : item.value());
    this.mixed.set(false);

    return true;
  }

  private createDataItem(data: SelectOptionData) {
    const label = signal(data.label);
    const disabledInput = signal(data.disabled ?? false);
    const element = signal<HTMLElement | null>(null);
    const dataSignal = signal(data);

    const selected = computed(() => this.isValueSelected(data.value));

    const item: SelectItem = {
      value: signal(data.value).asReadonly(),
      checked: signal(false),
      // mirrors the projected option's behavior: once `maxSelection` is reached, the
      // remaining unselected options read as unavailable
      disabled: computed(() => disabledInput() || (this.isFull() && !selected())),
      element: element.asReadonly(),
      id: signal(createComponentId('et-select-option')).asReadonly(),
      label: label.asReadonly(),
      data: dataSignal.asReadonly(),
    };

    return { item, label, disabledInput, element, data: dataSignal };
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

  // the value write shared by `commitCustomValue` and the close-time commit - the latter
  // must not call `hide()` while the panel is already closing
  private applyCustomValue(raw: string) {
    if (this.disabled() || this.readonly() || this.isFull()) {
      return false;
    }

    const value = this.normalizeCustomValue()(raw);

    if (value === null) {
      return false;
    }

    // the string is its own label - cache it so the trigger can display it
    this.labelCache.update((cache) => new Map(cache).set(value, value));

    if (this.multiple()) {
      const current = this.value();
      const values = this.mixed() ? [] : Array.isArray(current) ? current : [];

      if (values.includes(value)) {
        return false;
      }

      this.value.set([...values, value]);
      this.mixed.set(false);
      this.registeredSearch()?.clear();
    } else {
      this.value.set(value);
      this.mixed.set(false);
    }

    return true;
  }

  private commitOptionWhileClosed(item: SelectItem) {
    if (this.disabled() || this.readonly() || item.disabled()) {
      return;
    }

    if (this.mixed()) {
      this.commitMixedOption(item);

      return;
    }

    this.pickSingleOption(item);
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

    // deliberately no wrap - matches the ARIA select-only combobox pattern
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
  // button - anchor (and width-mirror) the panel to the frame so it lines up with the field
  private resolveAnchorElement() {
    return this.formField?.controlFrameElement() ?? this.registeredTrigger()?.elementRef.nativeElement;
  }

  private handleFrameClick(event: MouseEvent) {
    const target = event.target;
    const frame = event.currentTarget;

    if (!(target instanceof HTMLElement) || !(frame instanceof HTMLElement) || this.disabled() || this.readonly()) {
      return;
    }

    // the trigger (and everything inside it - chips, clear, chevron, inline search) already
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
      // and opens - only the chevron toggles closed
      this.show();
      search.focus();

      return;
    }

    this.registeredTrigger()?.elementRef.nativeElement.focus({ preventScroll: true });
    this.toggle();
  }

  // initial virtual focus: the selected option, else the first enabled one - unless a keydown
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
    this.pendingActiveScrollItem = null;

    // pending text becomes a value instead of being discarded (tag-input's commit-on-blur).
    // An Escape close never reaches this with a query - Escape clears it first.
    if (this.allowCustomValues() && this.commitCustomValueOnClose()) {
      this.applyCustomValue(this.query());
    }

    // a stale query would silently keep filtering the next open - cleared at close-start so the
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
      if (this.mixed()) {
        search.restoreMixedDisplay();
      } else {
        search.clear();
      }

      return;
    }

    this.hide();
  }
}
