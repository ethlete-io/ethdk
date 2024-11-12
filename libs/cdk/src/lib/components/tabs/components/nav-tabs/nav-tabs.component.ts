import { NgClass } from '@angular/common';
import {
  AfterContentChecked,
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  forwardRef,
  HostBinding,
  inject,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ScrollObserverIgnoreTargetDirective, TypedQueryList } from '@ethlete/core';
import { filter, startWith, takeUntil, tap } from 'rxjs';
import { ScrollableComponent } from '../../../scrollable/components/scrollable';
import { NavTabLinkComponent } from '../../partials/nav-tabs/nav-tab-link';
import { NavTabsOutletComponent } from '../../partials/nav-tabs/nav-tabs-outlet';
import { ActiveTabUnderlineBarManager, ActiveTabUnderlineDirective, PaginatedTabHeaderDirective } from '../../utils';

@Component({
  selector: '[et-nav-tabs]',
  templateUrl: 'nav-tabs.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  standalone: true,
  imports: [ScrollableComponent, NgClass, ScrollObserverIgnoreTargetDirective],
  host: {
    class: 'et-nav-tabs',
  },
  styles: `
    .et-nav-tabs {
      display: block;

      .et-nav-tab-link {
        white-space: nowrap;
      }

      .et-nav-tab-link:not([aria-disabled='true']) {
        cursor: pointer;
      }

      .et-scrollable-container {
        position: relative;
      }
    }
  `,
})
export class NavTabsComponent
  extends PaginatedTabHeaderDirective
  implements OnInit, AfterContentChecked, AfterContentInit, OnDestroy
{
  private _router = inject(Router);

  @Input()
  tabOutlet?: NavTabsOutletComponent;

  @ContentChildren(forwardRef(() => NavTabLinkComponent), { descendants: true })
  _items!: TypedQueryList<NavTabLinkComponent>;

  @ContentChildren(forwardRef(() => ActiveTabUnderlineDirective), { descendants: true })
  _inkBars!: TypedQueryList<ActiveTabUnderlineDirective>;

  @ViewChild(ScrollableComponent, { static: true })
  _scrollable!: ScrollableComponent;

  _activeTabUnderlineManager?: ActiveTabUnderlineBarManager;

  @HostBinding('attr.role')
  get _attrRole() {
    return this._getRole();
  }

  ngOnInit(): void {
    this._router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        tap(() => this.updateActiveLink()),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  protected _itemSelected() {
    // noop
  }

  override ngAfterContentInit() {
    this._activeTabUnderlineManager = new ActiveTabUnderlineBarManager(this._inkBars);
    this._items.changes
      .pipe(
        startWith(this._items.toArray()),
        tap(() => this.updateActiveLink()),
        takeUntil(this._destroy$),
      )
      .subscribe();

    super.ngAfterContentInit();
  }

  updateActiveLink() {
    if (!this._items) {
      return;
    }

    const items = this._items.toArray();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item) {
        continue;
      }

      if (item?.active) {
        this.selectedIndex = i;
        this._cdr.markForCheck();

        if (this.tabOutlet) {
          this.tabOutlet._activeTabId = item.id;
        }

        return;
      }
    }

    this.selectedIndex = -1;
    this._activeTabUnderlineManager?.hide();
  }

  _getRole(): string | null {
    return this.tabOutlet ? 'tablist' : this._elementRef.nativeElement.getAttribute('role');
  }
}
