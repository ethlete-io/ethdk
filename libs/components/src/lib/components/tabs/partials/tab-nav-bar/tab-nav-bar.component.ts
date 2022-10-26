import { Directionality } from '@angular/cdk/bidi';
import { ViewportRuler } from '@angular/cdk/scrolling';
import { NgClass } from '@angular/common';
import {
  Component,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  AfterContentChecked,
  AfterContentInit,
  OnDestroy,
  Input,
  ContentChildren,
  forwardRef,
  QueryList,
  ViewChild,
  ElementRef,
  HostBinding,
  Optional,
  NgZone,
  ChangeDetectorRef,
  OnInit,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, startWith, takeUntil, tap } from 'rxjs';
import { ScrollableComponent } from '../../../scrollable';
import { TabNavPanelComponent } from '../../components/tab-nav-panel';
import { PaginatedTabHeaderDirective } from '../../utils';
import { TabInkBarComponent } from '../tab-ink-bar';
import { TabLinkDirective } from '../tab-link';

@Component({
  selector: '[et-tab-nav-bar]',
  templateUrl: 'tab-nav-bar.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  standalone: true,
  imports: [ScrollableComponent, NgClass, TabInkBarComponent],
  host: {
    class: 'et-tab-nav-bar',
  },
})
export class TabNavBarComponent
  extends PaginatedTabHeaderDirective
  implements OnInit, AfterContentChecked, AfterContentInit, OnDestroy
{
  @Input()
  tabPanel?: TabNavPanelComponent;

  @ContentChildren(forwardRef(() => TabLinkDirective), { descendants: true })
  _items!: QueryList<TabLinkDirective>;

  @ViewChild(TabInkBarComponent, { static: true })
  _inkBar!: TabInkBarComponent;

  @ViewChild(ScrollableComponent, { static: true })
  _scrollable!: ScrollableComponent;

  // @HostBinding('class')
  // get hostClasses() {
  //   const borderedClass = this.bordered ? 'border-b border-gg-dark-3' : '';

  //   return `block ${borderedClass}`;
  // }

  @HostBinding('attr.role')
  get _attrRole() {
    return this._getRole();
  }

  constructor(
    elementRef: ElementRef,
    @Optional() dir: Directionality,
    ngZone: NgZone,
    public override _cdr: ChangeDetectorRef,
    viewportRuler: ViewportRuler,
    private _router: Router,
  ) {
    super(elementRef, _cdr, viewportRuler, dir, ngZone);
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
      if (items[i].active) {
        this.selectedIndex = i;
        this._cdr.markForCheck();

        if (this.tabPanel) {
          this.tabPanel._activeTabId = items[i].id;
        }

        return;
      }
    }

    this.selectedIndex = -1;
    this._inkBar.hide();
  }

  _getRole(): string | null {
    return this.tabPanel ? 'tablist' : this._elementRef.nativeElement.getAttribute('role');
  }
}
