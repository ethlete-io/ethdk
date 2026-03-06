import { FocusableOption, FocusMonitor } from '@angular/cdk/a11y';
import { SPACE } from '@angular/cdk/keycodes';
import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostAttributeToken,
  inject,
  Input,
  NgZone,
  numberAttribute,
  OnDestroy,
  OnInit,
  untracked,
} from '@angular/core';
import { isActive, IsActiveMatchOptions, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { applyHostListeners } from '@ethlete/core';
import { NavTabsComponent } from '../../../components/nav-tabs/nav-tabs.component';
import { ActiveTabUnderlineDirective } from '../../../utils';

let nextUniqueId = 0;

@Component({
  selector: '[et-nav-tab-link]',
  template: `
    <span class="et-tab-content">
      <ng-content />
    </span>
  `,
  host: {
    class: 'et-nav-tab-link',
    '[id]:': 'id',
    '[attr.aria-controls]': '_getAriaControls()',
    '[attr.aria-current]': '_getAriaCurrent()',
    '[attr.aria-disabled]': 'disabled',
    '[attr.aria-selected]': '_getAriaSelected()',
    '[attr.tabIndex]': '_getTabIndex()',
    '[attr.role]': '_getRole()',
  },
  hostDirectives: [{ directive: ActiveTabUnderlineDirective, inputs: ['fitUnderlineToContent'] }],
})
export class NavTabLinkComponent implements OnInit, AfterViewInit, OnDestroy, FocusableOption {
  private _tabNavBar = inject(NavTabsComponent);
  public elementRef = inject(ElementRef);
  private _focusMonitor = inject(FocusMonitor);
  private _router = inject(Router);
  private _cdr = inject(ChangeDetectorRef);
  private _ngZone = inject(NgZone);
  public _link = inject(RouterLink, { optional: true });
  public _linkWithHref = inject(RouterLink, { optional: true });
  public _linkConfig = inject(RouterLinkActive, { optional: true });

  get active(): boolean {
    const link = this._link || this._linkWithHref;
    const activeOptions = this._linkConfig?.routerLinkActiveOptions ?? {
      exact: false,
    };

    if (!link) {
      return false;
    }

    const options: Partial<IsActiveMatchOptions> = isActiveMatchOptions(activeOptions)
      ? activeOptions
      : (activeOptions.exact ?? false)
        ? { ...exactMatchOptions }
        : { ...subsetMatchOptions };

    const tree = link.urlTree;

    return tree ? untracked(() => isActive(tree, this._router, options)()) : false;
  }

  @Input({ transform: (v: unknown) => numberAttribute(v, 0) })
  tabIndex = 0;

  @Input({ transform: booleanAttribute })
  disabled = false;

  @Input()
  id = `et-nav-tab-link-${nextUniqueId++}`;

  constructor() {
    const tabIndex = inject(new HostAttributeToken('tabindex'), { optional: true });

    this.tabIndex = tabIndex ? parseInt(tabIndex) : 0;

    applyHostListeners({
      focus: () => {
        this._tabNavBar.focusIndex = this._tabNavBar._items.toArray().indexOf(this);
      },
      keydown: (event) => {
        if (event.keyCode === SPACE) {
          this.elementRef.nativeElement.click();
        }
      },
    });
  }

  ngOnInit(): void {
    this._ngZone.runOutsideAngular(() => {
      this.elementRef.nativeElement.addEventListener('click', this._haltDisabledEvents);
    });
  }

  ngAfterViewInit() {
    this._focusMonitor.monitor(this.elementRef);
  }

  ngOnDestroy() {
    this._focusMonitor.stopMonitoring(this.elementRef);
    this.elementRef.nativeElement.removeEventListener('click', this._haltDisabledEvents);
  }

  focus() {
    this.elementRef.nativeElement.focus();
  }

  _getAriaControls(): string | null {
    return this._tabNavBar.tabOutlet
      ? this._tabNavBar.tabOutlet?.id
      : this.elementRef.nativeElement.getAttribute('aria-controls');
  }

  _getAriaSelected(): string | null {
    return this.active ? 'true' : 'false';
  }

  _getAriaCurrent(): string | null {
    return this.active && !this._tabNavBar.tabOutlet ? 'page' : null;
  }

  _getRole(): string | null {
    return this._tabNavBar.tabOutlet ? 'tab' : this.elementRef.nativeElement.getAttribute('role');
  }

  _getTabIndex(): number {
    if (this._tabNavBar.tabOutlet) {
      return this.active && !this.disabled ? 0 : -1;
    } else {
      return this.tabIndex;
    }
  }

  _markForCheck() {
    this._cdr.markForCheck();
  }

  private _haltDisabledEvents = (event: Event) => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
}

function isActiveMatchOptions(
  options: { exact: boolean } | Partial<IsActiveMatchOptions>,
): options is Partial<IsActiveMatchOptions> {
  const o = options as Partial<IsActiveMatchOptions>;
  return !!(o.paths || o.matrixParams || o.queryParams || o.fragment);
}

/**
 * The equivalent `IsActiveMatchOptions` options for `isActive` is called with `true`
 * (exact = true).
 */
export const exactMatchOptions: IsActiveMatchOptions = {
  paths: 'exact',
  fragment: 'ignored',
  matrixParams: 'ignored',
  queryParams: 'exact',
};

/**
 * The equivalent `IsActiveMatchOptions` options for `isActive` is called with `false`
 * (exact = false).
 */
export const subsetMatchOptions: IsActiveMatchOptions = {
  paths: 'subset',
  fragment: 'ignored',
  matrixParams: 'ignored',
  queryParams: 'subset',
};
