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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { RuntimeError, nextFrame } from '@ethlete/core';
import { fromEvent, take, tap } from 'rxjs';
import { sortByDomOrder } from '../../../internals/dom-order';
import { createTypeahead } from '../../../internals/typeahead';
import { OverlayConfig } from '../../../overlay/overlay-config';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { OverlayRef } from '../../../overlay/overlay-ref';
import { OverlayTemplateHostComponent } from '../../../overlay/overlay-template-host.component';
import { anchoredOverlayStrategy } from '../../../overlay/strategies';
import { FORM_FIELD_CONTROL_TYPES, FORM_FIELD_TOKEN, FormFieldControl } from '../../form-field/headless';
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
  private overlayManager = injectOverlayManager();

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
  public describedById = computed(() => this.describedBy());

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
  /** @internal */
  public overlayRef = signal<OverlayRef<OverlayTemplateHostComponent, unknown> | null>(null);
  /** @internal The option that holds virtual focus while the listbox is open. */
  public activeItem = signal<SelectItem | null>(null);

  public selection = createSelectionState<unknown, SelectItem>({
    value: this.value,
    multiple: this.multiple,
    disabled: this.disabled,
  });

  public activeId = computed(() => this.activeItem()?.id() ?? null);
  public listboxId = computed(() => this.registeredListbox()?.id ?? null);
  public isMounted = computed(() => this.overlayRef() !== null);

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

  // Escape is handled here instead of by the overlay runtime: with a search input, the
  // first Escape only clears the query — the runtime's own handler would close immediately
  // (it runs during the capture phase, before the input ever sees the key)
  private interactionListenersCleanup: (() => void) | null = null;
  private closedByOutsidePointer = false;

  constructor() {
    this.formField?.registerControl(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterControl(this));

    effect(() => {
      const entries = this.selection.items().map((item) => [item.value(), item.label()] as const);

      untracked(() => {
        if (!entries.length) {
          return;
        }

        this.labelCache.update((cache) => {
          const next = new Map(cache);

          for (const [value, label] of entries) {
            next.set(value, label);
          }

          return next;
        });
      });
    });

    effect(() => {
      const disabled = this.disabled();
      const shouldBeOpen = this.open();
      const currentRef = this.overlayRef();

      if (disabled) {
        if (currentRef) {
          untracked(() => currentRef.close());
        }

        if (shouldBeOpen) {
          untracked(() => this.open.set(false));
        }

        return;
      }

      if (shouldBeOpen && !currentRef) {
        untracked(() => this.mountOverlay());

        return;
      }

      if (!shouldBeOpen && currentRef) {
        untracked(() => currentRef.close());
      }
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

    this.destroyRef.onDestroy(() => {
      this.typeahead.destroy();
      this.detachInteractionListeners();
      this.overlayRef()?.close();
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
      this.overlayRef()?.close();
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

      this.value.set(adding ? [...values, itemValue] : values.filter((candidate) => candidate !== itemValue));

      // adding while searching: clear the query so the full list is back for the next pick
      // (toggling off keeps it — the user may be pruning several filtered values)
      if (adding) {
        this.registeredSearch()?.clear();
      }
    } else {
      this.selection.select(item);
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
  public setActiveItem(item: SelectItem, options?: { scroll?: boolean }) {
    this.activeItem.set(item);

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

    const query = this.query().trim();

    if (this.allowCustomValues() && query) {
      this.commitCustomValue(query);

      return;
    }

    this.hide();
  }

  private commitCustomValue(rawValue: string) {
    if (this.disabled() || this.readonly()) {
      return;
    }

    // the raw string is its own label — cache it so the trigger can display it
    this.labelCache.update((cache) => new Map(cache).set(rawValue, rawValue));

    if (this.multiple()) {
      const current = this.value();
      const values = Array.isArray(current) ? current : [];

      if (!values.includes(rawValue)) {
        this.value.set([...values, rawValue]);
      }

      this.registeredSearch()?.clear();
    } else {
      this.value.set(rawValue);
      this.hide();
    }
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

  private mountOverlay() {
    const surface = this.registeredSurface();

    if (!surface) {
      return;
    }

    const templateContext: SelectSurfaceContext = {
      $implicit: this,
      select: this,
      close: () => this.hide(),
    };

    const config: OverlayConfig = {
      bindings: [inputBinding('template', () => surface.templateRef), inputBinding('context', () => templateContext)],
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
      origin: this.resolveAnchorElement(),
      panelClass: 'et-select-overlay-pane',
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

    const overlayRef = this.overlayManager.open<OverlayTemplateHostComponent>(OverlayTemplateHostComponent, config);

    this.overlayRef.set(overlayRef);

    // initial virtual focus: the selected option, else the first enabled one — unless a
    // keydown right after opening (before this frame) already moved the active item
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

    this.attachInteractionListeners();

    // sync the open model as soon as any close begins so aria-expanded and the trigger
    // state flip before the leave animation
    overlayRef
      .beforeClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (this.overlayRef() !== overlayRef) {
            return;
          }

          this.detachInteractionListeners();
          this.activeItem.set(null);

          if (this.open()) {
            this.open.set(false);
          }

          // a stale query would silently keep filtering the next open — cleared at
          // close-start so the trigger's value display is correct during the leave animation
          const search = this.registeredSearch();

          if (search && this.query()) {
            search.clear();
          }
        }),
      )
      .subscribe();

    overlayRef
      .afterClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (this.overlayRef() !== overlayRef) {
            return;
          }

          this.overlayRef.set(null);

          const closedByOutsidePointer = this.closedByOutsidePointer;

          this.closedByOutsidePointer = false;

          // focus that sat inside the pane fell to <body> with the pane's removal — hand it
          // back to the field, except for outside closes (the user deliberately went elsewhere)
          if (!closedByOutsidePointer && this.document.activeElement === this.document.body) {
            this.activate();
          }
        }),
      )
      .subscribe();
  }

  // Interactive closes are handled here instead of by the overlay runtime: the first Escape
  // only clears a search query (the runtime's capture-phase handler would close before the
  // input ever saw the key), and a pointerdown inside the field — the inline search input,
  // the chips — must not close the panel at all.
  private attachInteractionListeners() {
    this.detachInteractionListeners();

    const onKeyDown = (event: KeyboardEvent) => {
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
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const pane = this.overlayRef()?.elements?.paneElement;

      if (pane?.contains(target)) {
        return;
      }

      const anchor = this.resolveAnchorElement();

      if (anchor?.contains(target)) {
        return;
      }

      this.closedByOutsidePointer = true;
      this.hide();
    };

    const keydownSubscription = fromEvent<KeyboardEvent>(this.document, 'keydown').subscribe(onKeyDown);
    const pointerdownSubscription = fromEvent<PointerEvent>(this.document, 'pointerdown', { capture: true }).subscribe(
      onPointerDown,
    );

    this.interactionListenersCleanup = () => {
      keydownSubscription.unsubscribe();
      pointerdownSubscription.unsubscribe();
    };
  }

  private detachInteractionListeners() {
    this.interactionListenersCleanup?.();
    this.interactionListenersCleanup = null;
  }
}
