import {
  DOCUMENT,
  DestroyRef,
  Directive,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  inputBinding,
  model,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  OverlayRuntimeAnchoredPosition,
  RuntimeError,
  anchoredOverlayPosition,
  enableAnchoredOverlayPositionExtras,
  injectHostElement,
  nextFrame,
  randomId,
} from '@ethlete/core';
import { OffsetOptions, Padding, Placement, VirtualElement } from '@floating-ui/dom';
import { fromEvent, take, tap } from 'rxjs';
import { OverlayConfig } from '../../overlay/overlay-config';
import { injectOverlayManager } from '../../overlay/overlay-manager';
import { OverlayRef } from '../../overlay/overlay-ref';
import { OverlayTemplateHostComponent } from '../../overlay/overlay-template-host.component';
import { OverlayStrategy, OverlayStrategyBreakpoint, anchoredOverlayStrategy } from '../../overlay/strategies';
import { MENU_ERROR_CODES } from '../menu-errors';
import { sortByDomOrder } from './internals/menu-dom-order';
import { createMenuHoverIntent } from './internals/menu-hover-intent';
import { createMenuTypeahead } from './internals/menu-typeahead';
import { MenuContextTriggerDirective } from './menu-context-trigger.directive';
import { MenuItemDirective } from './menu-item.directive';
import { MenuPanelDirective } from './menu-panel.directive';
import { MenuSearchDirective } from './menu-search.directive';
import { MenuSurfaceContext, MenuSurfaceDirective } from './menu-surface.directive';
import { MenuTriggerDirective } from './menu-trigger.directive';

export type MenuCloseReason = 'item' | 'escape' | 'tab' | 'outside' | 'api';

export type MenuOpenSource = 'click' | 'hover' | 'keyboard' | 'api';

export type MenuAnchorPoint = { x: number; y: number };

const MENU_MIN_AVAILABLE_SPACE = 160;

@Directive({
  selector: '[etMenu]',
  exportAs: 'etMenu',
  host: {
    '[attr.data-menu-open]': 'open() || null',
  },
})
export class MenuDirective {
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private overlayManager = injectOverlayManager();
  private readonly hostElement = injectHostElement();

  public parent = inject(MenuDirective, { optional: true, skipSelf: true });

  public placement = input<Placement | 'auto'>('auto');
  public fallbackPlacements = input<Placement[] | undefined>(undefined);
  public offset = input<OffsetOptions | null | 'auto'>('auto');
  public viewportPadding = input<Padding | null>(8);
  /** Render an arrow pointing at the trigger. Trigger-anchored root menus only - submenus and context menus never render one. */
  public arrow = input(true, { transform: booleanAttribute });
  public arrowPadding = input<Padding | null>(14);
  // eslint-disable-next-line ethlete/no-native-html-input-name -- mirrors the native autofocus behaviour on open
  public autoFocus = input(true, { transform: booleanAttribute });
  public hoverOpen = input(true, { transform: booleanAttribute });
  /**
   * Wrap around at the ends: `ArrowDown` on the last item goes to the first. Turn it off for a long
   * menu, where wrapping reads as a jump to somewhere unrelated rather than as continuing - the
   * arrows then simply stop at the ends.
   *
   * Does not apply to a menu with a search field: there the ends hand focus back to the field, which
   * is a more useful destination than either wrapping or stopping.
   * @default true
   */
  public loop = input(true, { transform: booleanAttribute });
  public hoverOpenDelay = input(120, { transform: numberAttribute });
  public hoverCloseDelay = input(300, { transform: numberAttribute });
  public disabled = input(false, { transform: booleanAttribute });
  public open = model(false);

  public root: MenuDirective = this.parent?.root ?? this;
  public depth: number = (this.parent?.depth ?? -1) + 1;
  public isRoot = this.parent === null;

  /** @internal */
  public registeredTrigger = signal<MenuTriggerDirective | null>(null);
  /** @internal */
  public registeredContextTrigger = signal<MenuContextTriggerDirective | null>(null);
  /** @internal */
  public registeredSurface = signal<MenuSurfaceDirective | null>(null);
  /** @internal */
  public registeredPanel = signal<MenuPanelDirective | null>(null);
  /** @internal */
  public registeredSearch = signal<MenuSearchDirective | null>(null);
  /** @internal */
  public overlayRef = signal<OverlayRef<OverlayTemplateHostComponent, unknown> | null>(null);
  /** @internal */
  public openSubmenu = signal<MenuDirective | null>(null);
  /** @internal */
  public activeItem = signal<MenuItemDirective | null>(null);
  /** @internal */
  public anchorPoint = signal<MenuAnchorPoint | null>(null);

  private items = signal<MenuItemDirective[]>([]);

  /** @internal */
  public sortedItems = computed(() => sortByDomOrder(this.items(), (item) => item.elementRef.nativeElement));
  /** @internal */
  public enabledItems = computed(() => this.sortedItems().filter((item) => !item.isDisabled()));

  public isMounted = computed(() => this.overlayRef() !== null);

  private openSource: MenuOpenSource = 'api';
  private initialFocusTarget: 'first' | 'last' = 'first';
  private hoverIntent = createMenuHoverIntent();
  private typeahead = createMenuTypeahead();
  private rootListenersCleanup: (() => void) | null = null;

  constructor() {
    effect(() => {
      const disabled = this.disabled();
      const shouldBeOpen = this.open();
      const currentRef = this.overlayRef();

      if (disabled) {
        if (currentRef) {
          untracked(() => this.hide());
        }

        if (shouldBeOpen) {
          untracked(() => {
            this.open.set(false);
          });
        }

        return;
      }

      if (shouldBeOpen && !currentRef) {
        untracked(() => {
          this.mountOverlay();
        });

        return;
      }

      if (!shouldBeOpen && currentRef) {
        untracked(() => {
          this.openSubmenu()?.hide();
          currentRef.close();
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      this.hoverIntent.destroy();
      this.typeahead.destroy();
      this.detachRootInteractionListeners();

      if (this.parent?.openSubmenu() === this) {
        this.parent.openSubmenu.set(null);
      }

      this.overlayRef()?.close();
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.registeredSurface()) {
          throw new RuntimeError(
            MENU_ERROR_CODES.MISSING_MENU_SURFACE,
            '[MenuDirective] Menu surface not found. Add <ng-template etMenuSurface> inside the [etMenu] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  public show(source: MenuOpenSource = 'api', initialFocus: 'first' | 'last' = 'first') {
    if (this.disabled() || this.open()) {
      return;
    }

    this.openSource = source;
    this.initialFocusTarget = initialFocus;
    this.parent?.openSubmenuExclusive(this);
    this.open.set(true);
  }

  public hide() {
    this.hoverIntent.cancelAll();
    this.openSubmenu()?.hide();

    if (this.parent?.openSubmenu() === this) {
      this.parent.openSubmenu.set(null);
    }

    if (this.open()) {
      this.open.set(false);
    } else {
      this.overlayRef()?.close();
    }
  }

  public toggle(source: MenuOpenSource = 'api') {
    if (this.open()) {
      this.hide();

      return;
    }

    this.show(source);
  }

  /** Closes the whole menu tree, regardless of which level this is called on. */
  public closeAll(reason: MenuCloseReason = 'api') {
    const root = this.root;

    if (reason === 'item' || reason === 'escape' || reason === 'tab') {
      root.focusTrigger();
    }

    root.hide();
  }

  /** Opens the menu anchored to a viewport point instead of the trigger element. */
  public openAt(point: MenuAnchorPoint, source: MenuOpenSource = 'click') {
    if (this.disabled()) {
      return;
    }

    this.anchorPoint.set(point);

    const overlayRef = this.overlayRef();

    if (overlayRef) {
      // already mounted (or still closing) - reposition in place and cancel any pending close
      overlayRef.updatePositionStrategy(this.buildVirtualAnchoredPosition(point));
      this.open.set(true);

      return;
    }

    this.show(source);
  }

  /** @internal Closes this level and returns focus to the trigger item in the parent menu. */
  public closeLevel(reason: MenuCloseReason) {
    if (this.isRoot) {
      this.closeAll(reason);

      return;
    }

    const triggerItem = this.registeredTrigger()?.hostItem ?? null;

    if (triggerItem && this.parent) {
      this.parent.setActiveItem(triggerItem);
    }

    this.hide();
  }

  /** @internal */
  public openSubmenuExclusive(submenu: MenuDirective) {
    const current = this.openSubmenu();

    if (current && current !== submenu) {
      current.hide();
    }

    this.openSubmenu.set(submenu);
  }

  /** @internal */
  public registerItem(item: MenuItemDirective) {
    this.items.update((items) => [...items, item]);
  }

  /** @internal */
  public unregisterItem(item: MenuItemDirective) {
    this.items.update((items) => items.filter((registered) => registered !== item));

    if (this.activeItem() === item) {
      this.activeItem.set(null);
    }
  }

  /** @internal */
  public unregisterTrigger(trigger: MenuTriggerDirective) {
    if (this.registeredTrigger() === trigger) {
      this.registeredTrigger.set(null);
    }
  }

  /** @internal */
  public unregisterContextTrigger(trigger: MenuContextTriggerDirective) {
    if (this.registeredContextTrigger() === trigger) {
      this.registeredContextTrigger.set(null);
    }
  }

  /** @internal */
  public unregisterSurface(surface: MenuSurfaceDirective) {
    if (this.registeredSurface() === surface) {
      this.registeredSurface.set(null);
    }
  }

  /** @internal */
  public unregisterPanel(panel: MenuPanelDirective) {
    if (this.registeredPanel() === panel) {
      this.registeredPanel.set(null);
    }
  }

  /** @internal */
  public unregisterSearch(search: MenuSearchDirective) {
    if (this.registeredSearch() === search) {
      this.registeredSearch.set(null);
    }
  }

  /** @internal */
  public setActiveItem(item: MenuItemDirective, options?: { focus?: boolean }) {
    this.activeItem.set(item);

    if (options?.focus !== false) {
      item.focus();
    }
  }

  /** @internal Central keyboard handling for items, the panel, and the search input. */
  public handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const search = this.registeredSearch();
    const searchFocused = search?.isFocused() ?? false;

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
      case 'ArrowRight': {
        const submenu = this.activeItem()?.submenu ?? null;

        if (submenu) {
          event.preventDefault();
          submenu.show('keyboard');
        }

        return;
      }
      case 'ArrowLeft': {
        if (!this.isRoot) {
          event.preventDefault();
          this.closeLevel('escape');
        }

        return;
      }
      case 'Home': {
        if (!searchFocused) {
          event.preventDefault();
          this.setActiveToEdge('first');
        }

        return;
      }
      case 'End': {
        if (!searchFocused) {
          event.preventDefault();
          this.setActiveToEdge('last');
        }

        return;
      }
      case 'Enter':
      case ' ': {
        if (searchFocused) {
          return;
        }

        const item = this.activeItem();

        if (!item) {
          return;
        }

        event.preventDefault();

        if (item.submenu) {
          item.submenu.show('keyboard');
        } else {
          item.activateFromKeyboard(event.key === 'Enter' ? 'keyboard-enter' : 'keyboard-space');
        }

        return;
      }
      case 'Escape': {
        event.preventDefault();
        this.closeLevel('escape');

        return;
      }
      case 'Tab': {
        this.closeAll('tab');

        return;
      }
      default: {
        if (event.key.length !== 1 || searchFocused) {
          return;
        }

        if (search) {
          event.preventDefault();
          this.activeItem.set(null);
          search.appendCharacter(event.key);

          return;
        }

        const query = this.typeahead.append(event.key);
        const match = this.enabledItems().find((item) => item.textContent().toLowerCase().startsWith(query));

        if (match) {
          event.preventDefault();
          this.setActiveItem(match);
        }

        return;
      }
    }
  }

  /** @internal */
  public notifyItemPointerEnter(item: MenuItemDirective) {
    if (!item.isDisabled()) {
      // Hovering marks the item active, but it must not pull DOM focus out of the search field: the
      // pointer crossing the list while someone is typing would otherwise swallow the rest of their
      // query. Keyboard navigation still moves focus into the items (see `moveActive`), which is the
      // gesture that means "I am done typing".
      const searchFocused = this.registeredSearch()?.isFocused() ?? false;

      this.setActiveItem(item, { focus: !searchFocused && this.isFocusInsideTree() });
    }

    this.handleItemHover(item);
  }

  /** @internal Cancels pending submenu hover timers along the ancestor chain. */
  public notifyPanelPointerEnter() {
    for (let ancestor = this.parent; ancestor; ancestor = ancestor.parent) {
      ancestor.hoverIntent.cancelAll();
    }
  }

  /** @internal */
  public focusTrigger() {
    const element =
      this.registeredTrigger()?.elementRef.nativeElement ?? this.registeredContextTrigger()?.elementRef.nativeElement;

    element?.focus({ preventScroll: true });
  }

  /** @internal True while a pointerdown target belongs to any open pane of this menu's tree. */
  public isTargetInsideTree(target: EventTarget | null) {
    if (!(target instanceof Node)) {
      return false;
    }

    let menu: MenuDirective | null = this.root;

    while (menu) {
      const pane = menu.overlayRef()?.elements?.paneElement;

      if (pane?.contains(target)) {
        return true;
      }

      menu = menu.openSubmenu();
    }

    return false;
  }

  private isFocusInsideTree() {
    const active = this.document.activeElement;

    if (!active) {
      return false;
    }

    if (this.isTargetInsideTree(active)) {
      return true;
    }

    const triggerElement = this.root.registeredTrigger()?.elementRef.nativeElement;

    return triggerElement?.contains(active) ?? false;
  }

  private handleItemHover(item: MenuItemDirective) {
    if (!this.hoverOpen()) {
      return;
    }

    const submenu = item.submenu;
    const currentSubmenu = this.openSubmenu();

    this.hoverIntent.cancelOpen();

    if (submenu) {
      if (currentSubmenu === submenu) {
        this.hoverIntent.cancelClose();

        return;
      }

      this.hoverIntent.scheduleOpen(() => submenu.show('hover'), this.hoverOpenDelay());
    }

    if (currentSubmenu && currentSubmenu !== submenu) {
      this.hoverIntent.scheduleClose(() => {
        if (this.openSubmenu() === currentSubmenu) {
          currentSubmenu.hide();
        }
      }, this.hoverCloseDelay());
    }
  }

  private moveActive(delta: 1 | -1) {
    const items = this.enabledItems();
    const search = this.registeredSearch();

    if (!items.length) {
      search?.focus();

      return;
    }

    if (search?.isFocused()) {
      this.setActiveToEdge(delta === 1 ? 'first' : 'last');

      return;
    }

    const current = this.activeItem();
    const index = current ? items.indexOf(current) : -1;

    if (index === -1) {
      this.setActiveToEdge(delta === 1 ? 'first' : 'last');

      return;
    }

    const nextIndex = index + delta;

    if (search && (nextIndex < 0 || nextIndex >= items.length)) {
      this.activeItem.set(null);
      search.focus();

      return;
    }

    // Past an end with `loop` off, there is nowhere to go - the active item stays where it is rather
    // than jumping to the other end of the menu.
    if (!this.loop() && (nextIndex < 0 || nextIndex >= items.length)) {
      return;
    }

    const wrappedIndex = (nextIndex + items.length) % items.length;
    const next = items[wrappedIndex];

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

  private mountOverlay() {
    const surface = this.registeredSurface();

    if (!surface) {
      return;
    }

    const templateContext: MenuSurfaceContext = {
      $implicit: this,
      menu: this,
      close: () => this.closeAll(),
    };

    const config: OverlayConfig = {
      bindings: [inputBinding('template', () => surface.templateRef), inputBinding('context', () => templateContext)],
      mode: 'non-modal',
      hasBackdrop: false,
      autoFocus: false,
      restoreFocus: false,
      closeOnEscape: false,
      closeOnOutsidePointer: false,
      origin: this.registeredTrigger()?.elementRef.nativeElement,
      panelClass: 'et-menu-overlay-pane',
      strategies: this.buildStrategies(),
    };

    const overlayRef = this.overlayManager.open<OverlayTemplateHostComponent>(OverlayTemplateHostComponent, config);

    this.overlayRef.set(overlayRef);

    if (this.isRoot) {
      this.attachRootInteractionListeners();
    }

    nextFrame(() => {
      if (this.overlayRef() === overlayRef) {
        this.applyInitialFocus();
      }
    });

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
          this.openSubmenu()?.hide();
          this.activeItem.set(null);
          this.detachRootInteractionListeners();

          if (this.parent?.openSubmenu() === this) {
            this.parent.openSubmenu.set(null);
          }

          // `open` was set back to true while the overlay was still closing (e.g. a context
          // menu reopened at a new position) - the mount effect remounts, keep the anchor
          if (this.open()) {
            return;
          }

          this.anchorPoint.set(null);
          this.openSource = 'api';
          this.initialFocusTarget = 'first';
        }),
      )
      .subscribe();
  }

  private applyInitialFocus() {
    if (!this.autoFocus() || this.openSource === 'hover' || this.openSource === 'api') {
      return;
    }

    const search = this.registeredSearch();

    if (search) {
      // a query kept from the last time the menu was open gets replaced by simply typing
      search.focus({ select: true });

      return;
    }

    const items = this.enabledItems();
    const target = this.initialFocusTarget === 'last' ? items.at(-1) : items[0];

    if (target) {
      this.setActiveItem(target);
    } else {
      this.registeredPanel()?.focus();
    }
  }

  private attachRootInteractionListeners() {
    this.detachRootInteractionListeners();

    const pointerdownSubscription = fromEvent<PointerEvent>(this.document, 'pointerdown', { capture: true })
      .pipe(
        tap((event) => {
          if (this.isTargetInsideTree(event.target)) {
            return;
          }

          const triggerElement = this.registeredTrigger()?.elementRef.nativeElement;

          // the subsequent click on the trigger toggles the menu closed on its own
          if (triggerElement && event.target instanceof Node && triggerElement.contains(event.target)) {
            return;
          }

          const contextTriggerElement = this.registeredContextTrigger()?.elementRef.nativeElement;

          // a right click on the context zone repositions via the upcoming contextmenu event
          if (
            event.button === 2 &&
            contextTriggerElement &&
            event.target instanceof Node &&
            contextTriggerElement.contains(event.target)
          ) {
            return;
          }

          this.closeAll('outside');
        }),
      )
      .subscribe();

    // bubble phase so handlers inside the tree (panel, items, search) can preventDefault first
    const keydownSubscription = fromEvent<KeyboardEvent>(this.document, 'keydown')
      .pipe(
        tap((event) => {
          if (event.key !== 'Escape' || event.defaultPrevented || this.isTargetInsideTree(event.target)) {
            return;
          }

          this.closeAll('escape');
        }),
      )
      .subscribe();

    this.rootListenersCleanup = () => {
      pointerdownSubscription.unsubscribe();
      keydownSubscription.unsubscribe();
    };
  }

  private detachRootInteractionListeners() {
    this.rootListenersCleanup?.();
    this.rootListenersCleanup = null;
  }

  private buildStrategies(): () => OverlayStrategyBreakpoint[] {
    const point = this.anchorPoint();
    const containerClass = ['et-overlay--anchored', 'et-overlay--menu'];
    const positionOptions = {
      placement: this.resolvedPlacement(),
      fallbackPlacements: this.resolvedFallbackPlacements(),
      minAvailableSpace: this.resolvedMinAvailableSpace(),
      offset: this.resolvedOffset(),
      arrowPadding: this.arrowPadding(),
      viewportPadding: this.viewportPadding(),
      autoResize: true,
      // cross axis so a menu that fits on neither side slides over its parent instead of
      // overflowing the viewport
      shift: { crossAxis: true },
    };

    if (!point) {
      return anchoredOverlayStrategy({
        containerClass,
        arrow: this.resolvedArrow(),
        ...positionOptions,
      });
    }

    const anchoredPosition = this.buildVirtualAnchoredPosition(point);

    const strategy: OverlayStrategy = {
      id: randomId(),
      config: {
        containerClass,
        positionStrategy: () => anchoredPosition,
      },
    };

    return () => [{ strategy }];
  }

  private buildVirtualAnchoredPosition(point: MenuAnchorPoint): OverlayRuntimeAnchoredPosition {
    const referenceElement: VirtualElement = {
      getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0),
      contextElement: this.registeredContextTrigger()?.elementRef.nativeElement,
    };

    enableAnchoredOverlayPositionExtras();

    return anchoredOverlayPosition({
      referenceElement,
      placement: this.resolvedPlacement(),
      fallbackPlacements: this.resolvedFallbackPlacements(),
      offset: this.resolvedOffset(),
      viewportPadding: this.viewportPadding(),
      autoResize: true,
      shift: { crossAxis: true },
    });
  }

  private resolvedPlacement(): Placement {
    const placement = this.placement();

    if (placement !== 'auto') {
      return placement;
    }

    if (this.anchorPoint()) {
      return 'right-start';
    }

    return this.isRoot ? 'bottom-start' : 'right-start';
  }

  private resolvedFallbackPlacements(): Placement[] {
    const fallbackPlacements = this.fallbackPlacements();

    if (fallbackPlacements) {
      return fallbackPlacements;
    }

    if (this.isRoot && !this.anchorPoint()) {
      return ['bottom-end', 'top-start', 'top-end'];
    }

    return ['left-start', 'right-end', 'left-end'];
  }

  /**
   * `minAvailableSpace` replaces `flip` outright, so it may only kick in where no consumer has
   * expressed a placement preference of their own. It is also vertical-only: a submenu opens on the
   * x axis, where shrinking to the space beside the parent means a narrower - not a shorter - panel.
   */
  private resolvedMinAvailableSpace(): number | undefined {
    if (this.fallbackPlacements() || this.anchorPoint() || !this.isRoot) {
      return undefined;
    }

    const side = this.resolvedPlacement().split('-')[0];

    return side === 'top' || side === 'bottom' ? MENU_MIN_AVAILABLE_SPACE : undefined;
  }

  private resolvedArrow() {
    // a point anchor (context menu) has no element the arrow could meaningfully point at
    return this.arrow() && this.isRoot && !this.anchorPoint();
  }

  private resolvedOffset(): OffsetOptions | null {
    const offset = this.offset();

    if (offset !== 'auto') {
      return offset;
    }

    // the arrow protrudes half its size past the pane edge, so it needs a real gap
    if (this.resolvedArrow()) {
      return 10;
    }

    return this.isRoot && !this.anchorPoint() ? 4 : 0;
  }
}
