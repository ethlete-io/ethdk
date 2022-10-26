import { FocusableOption, FocusMonitor } from '@angular/cdk/a11y';
import { BooleanInput, coerceBooleanProperty, NumberInput, coerceNumberProperty } from '@angular/cdk/coercion';
import { SPACE } from '@angular/cdk/keycodes';
import {
  Directive,
  AfterViewInit,
  OnDestroy,
  Input,
  HostBinding,
  ElementRef,
  Attribute,
  HostListener,
  Optional,
  ChangeDetectorRef,
  OnInit,
  NgZone,
} from '@angular/core';
import { IsActiveMatchOptions, Router, RouterLink, RouterLinkActive, RouterLinkWithHref } from '@angular/router';
import { TabNavBarComponent } from '../tab-nav-bar';

let nextUniqueId = 0;

@Directive({
  selector: '[et-tab-link]',
  standalone: true,
  host: {
    class: 'et-tab-link',
  },
})
export class TabLinkDirective implements OnInit, AfterViewInit, OnDestroy, FocusableOption {
  get active(): boolean {
    const link = this._link || this._linkWithHref;

    if (!link) {
      return false;
    }

    const options: boolean | IsActiveMatchOptions = this._linkConfig
      ? isActiveMatchOptions(this._linkConfig?.routerLinkActiveOptions)
        ? this._linkConfig?.routerLinkActiveOptions
        : this._linkConfig?.routerLinkActiveOptions.exact
      : false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Stolen from https://github.com/angular/angular/blob/main/packages/router/src/directives/router_link_active.ts#L217
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isActive = link.urlTree ? this._router.isActive(link.urlTree, options as any) : false;

    return isActive;
  }

  @Input()
  get tabIndex(): number {
    return this.disabled ? -1 : this._tabIndex;
  }
  set tabIndex(value: NumberInput) {
    this._tabIndex = value != null ? coerceNumberProperty(value) : 0;
  }
  private _tabIndex = 0;

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  @Input()
  @HostBinding('attr.id')
  id = `et-tab-link-${nextUniqueId++}`;

  @HostBinding('attr.aria-controls')
  get _attrAriaControls() {
    return this._getAriaControls();
  }

  @HostBinding('attr.aria-current')
  get _attrAriaCurrent() {
    return this._getAriaCurrent();
  }

  @HostBinding('attr.aria-disabled')
  get _attrAriaDisabled() {
    return this.disabled;
  }

  @HostBinding('attr.aria-selected')
  get _attrAriaSelected() {
    return this._getAriaSelected();
  }

  @HostBinding('attr.tabIndex')
  get _attrTabIndex() {
    return this._getTabIndex();
  }

  @HostBinding('attr.role')
  get _attrRole() {
    return this._getRole();
  }

  constructor(
    private _tabNavBar: TabNavBarComponent,
    public elementRef: ElementRef,
    @Attribute('tabindex') tabIndex: string,
    private _focusMonitor: FocusMonitor,
    private _router: Router,
    private _cdr: ChangeDetectorRef,
    private _ngZone: NgZone,
    @Optional() public _link?: RouterLink,
    @Optional() public _linkWithHref?: RouterLinkWithHref,
    @Optional() public _linkConfig?: RouterLinkActive,
  ) {
    this.tabIndex = parseInt(tabIndex) || 0;
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

  @HostListener('focus')
  _handleFocus() {
    this._tabNavBar.focusIndex = this._tabNavBar._items.toArray().indexOf(this);
  }

  @HostListener('keydown', ['$event'])
  _handleKeydown(event: KeyboardEvent) {
    if (this._tabNavBar.tabPanel && event.keyCode === SPACE) {
      this.elementRef.nativeElement.click();
    }
  }

  _getAriaControls(): string | null {
    return this._tabNavBar.tabPanel
      ? this._tabNavBar.tabPanel?.id
      : this.elementRef.nativeElement.getAttribute('aria-controls');
  }

  _getAriaSelected(): string | null {
    if (this._tabNavBar.tabPanel) {
      return this.active ? 'true' : 'false';
    } else {
      return this.elementRef.nativeElement.getAttribute('aria-selected');
    }
  }

  _getAriaCurrent(): string | null {
    return this.active && !this._tabNavBar.tabPanel ? 'page' : null;
  }

  _getRole(): string | null {
    return this._tabNavBar.tabPanel ? 'tab' : this.elementRef.nativeElement.getAttribute('role');
  }

  _getTabIndex(): number {
    if (this._tabNavBar.tabPanel) {
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

function isActiveMatchOptions(options: { exact: boolean } | IsActiveMatchOptions): options is IsActiveMatchOptions {
  return !!(options as IsActiveMatchOptions).paths;
}
