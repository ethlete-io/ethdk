import { BooleanInput, coerceBooleanProperty, coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import {
  AfterContentChecked,
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  QueryList,
  TrackByFunction,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { A11yModule, FocusOrigin } from '@angular/cdk/a11y';
import { merge, Subscription, startWith } from 'rxjs';
import {
  TAB_GROUP,
  TabComponent,
  TabHeaderComponent,
  TabBodyComponent,
  TabLabelWrapperDirective,
} from '../../partials';
import { NgClass, NgForOf, NgIf } from '@angular/common';
import { PortalModule } from '@angular/cdk/portal';
import { NgClassType } from '@ethlete/core';

let nextId = 0;

export class TabChangeEvent {
  index!: number;
  tab!: TabComponent;
}

interface TabGroupBaseHeader {
  _alignInkBarToSelectedTab(): void;
  updatePagination(): void;
  focusIndex: number;
}

@Component({
  selector: 'et-tab-group',
  templateUrl: 'tab-group.component.html',
  styleUrls: ['tab-group.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  providers: [
    {
      provide: TAB_GROUP,
      useExisting: TabGroupComponent,
    },
  ],
  standalone: true,
  imports: [
    NgForOf,
    NgIf,
    TabHeaderComponent,
    NgClass,
    TabLabelWrapperDirective,
    A11yModule,
    TabBodyComponent,
    PortalModule,
  ],
  host: {
    class: 'et-tab-group',
  },
})
export class TabGroupComponent implements AfterContentInit, AfterContentChecked, OnDestroy {
  @Input()
  get selectedIndex(): number | null {
    return this._selectedIndex;
  }
  set selectedIndex(value: NumberInput) {
    this._indexToSelect = coerceNumberProperty(value, null);
  }
  private _selectedIndex: number | null = null;

  @Input()
  get contentTabIndex(): number | null {
    return this._contentTabIndex;
  }
  set contentTabIndex(value: NumberInput) {
    this._contentTabIndex = coerceNumberProperty(value, null);
  }
  private _contentTabIndex: number | null = null;

  @Input()
  get preserveContent(): boolean {
    return this._preserveContent;
  }
  set preserveContent(value: BooleanInput) {
    this._preserveContent = coerceBooleanProperty(value);
  }
  private _preserveContent = false;

  @Input()
  tabHeaderClasses: NgClassType;

  @Output()
  readonly selectedIndexChange = new EventEmitter<number>();

  @Output()
  readonly focusChange = new EventEmitter<TabChangeEvent>();

  @Output()
  readonly selectedTabChange = new EventEmitter<TabChangeEvent>(true);

  @ContentChildren(TabComponent, { descendants: true })
  _allTabs!: QueryList<TabComponent>;

  @ViewChild('tabBodyWrapper')
  _tabBodyWrapper!: ElementRef;

  @ViewChild('tabHeader')
  _tabHeader!: TabGroupBaseHeader;

  _tabs: QueryList<TabComponent> = new QueryList<TabComponent>();

  private _groupId = nextId++;
  private _indexToSelect: number | null = 0;
  private _lastFocusedTabIndex: number | null = null;
  private _tabsSubscription = Subscription.EMPTY;
  private _tabLabelSubscription = Subscription.EMPTY;

  constructor(private _cdr: ChangeDetectorRef) {}

  ngAfterContentInit() {
    this._subscribeToAllTabChanges();
    this._subscribeToTabLabels();

    this._tabsSubscription = this._tabs.changes.subscribe(() => {
      const indexToSelect = this._clampTabIndex(this._indexToSelect);

      if (indexToSelect === this._selectedIndex) {
        const tabs = this._tabs.toArray();
        let selectedTab: TabComponent | undefined;

        for (let i = 0; i < tabs.length; i++) {
          if (tabs[i].isActive) {
            this._indexToSelect = this._selectedIndex = i;
            this._lastFocusedTabIndex = null;
            selectedTab = tabs[i];
            break;
          }
        }

        if (!selectedTab && tabs[indexToSelect]) {
          Promise.resolve().then(() => {
            tabs[indexToSelect].isActive = true;
            this.selectedTabChange.emit(this._createChangeEvent(indexToSelect));
          });
        }
      }

      this._cdr.markForCheck();
    });
  }

  ngAfterContentChecked() {
    const indexToSelect = (this._indexToSelect = this._clampTabIndex(this._indexToSelect));

    if (this._selectedIndex != indexToSelect) {
      const isFirstRun = this._selectedIndex == null;

      if (!isFirstRun) {
        this.selectedTabChange.emit(this._createChangeEvent(indexToSelect));

        const wrapper = this._tabBodyWrapper.nativeElement;
        wrapper.style.minHeight = wrapper.clientHeight + 'px';
      }

      Promise.resolve().then(() => {
        this._tabs.forEach((tab, index) => (tab.isActive = index === indexToSelect));

        if (!isFirstRun) {
          this.selectedIndexChange.emit(indexToSelect);
          this._tabBodyWrapper.nativeElement.style.minHeight = '';
        }
      });
    }

    this._tabs.forEach((tab: TabComponent, index: number) => {
      tab.position = index - indexToSelect;

      if (this._selectedIndex != null && tab.position == 0 && !tab.origin) {
        tab.origin = indexToSelect - this._selectedIndex;
      }
    });

    if (this._selectedIndex !== indexToSelect) {
      this._selectedIndex = indexToSelect;
      this._lastFocusedTabIndex = null;
      this._cdr.markForCheck();
    }
  }

  ngOnDestroy() {
    this._tabs.destroy();
    this._tabsSubscription.unsubscribe();
    this._tabLabelSubscription.unsubscribe();
  }

  trackByTabFn: TrackByFunction<TabComponent> = (index) => index;

  realignInkBar() {
    if (this._tabHeader) {
      this._tabHeader._alignInkBarToSelectedTab();
    }
  }

  updatePagination() {
    if (this._tabHeader) {
      this._tabHeader.updatePagination();
    }
  }

  focusTab(index: number) {
    const header = this._tabHeader;

    if (header) {
      header.focusIndex = index;
    }
  }

  _focusChanged(index: number) {
    this._lastFocusedTabIndex = index;
    this.focusChange.emit(this._createChangeEvent(index));
  }

  _getTabLabelId(i: number): string {
    return `et-tab-label-${this._groupId}-${i}`;
  }

  _getTabContentId(i: number): string {
    return `et-tab-content-${this._groupId}-${i}`;
  }

  _handleClick(tab: TabComponent, tabHeader: TabGroupBaseHeader, index: number) {
    if (!tab.disabled) {
      this.selectedIndex = tabHeader.focusIndex = index;
    }
  }

  _getTabIndex(tab: TabComponent, index: number): number | null {
    if (tab.disabled) {
      return null;
    }
    const targetIndex = this._lastFocusedTabIndex ?? this.selectedIndex;
    return index === targetIndex ? 0 : -1;
  }

  _tabFocusChanged(focusOrigin: FocusOrigin, index: number) {
    if (focusOrigin && focusOrigin !== 'mouse' && focusOrigin !== 'touch') {
      this._tabHeader.focusIndex = index;
    }
  }

  private _subscribeToAllTabChanges() {
    this._allTabs.changes.pipe(startWith(this._allTabs)).subscribe((tabs: QueryList<TabComponent>) => {
      this._tabs.reset(
        tabs.filter((tab) => {
          return tab._closestTabGroup === this || !tab._closestTabGroup;
        }),
      );
      this._tabs.notifyOnChanges();
    });
  }

  private _clampTabIndex(index: number | null): number {
    return Math.min(this._tabs.length - 1, Math.max(index || 0, 0));
  }

  private _subscribeToTabLabels() {
    if (this._tabLabelSubscription) {
      this._tabLabelSubscription.unsubscribe();
    }

    this._tabLabelSubscription = merge(...this._tabs.map((tab) => tab._stateChanges)).subscribe(() =>
      this._cdr.markForCheck(),
    );
  }

  private _createChangeEvent(index: number): TabChangeEvent {
    const event = new TabChangeEvent();
    event.index = index;
    if (this._tabs && this._tabs.length) {
      event.tab = this._tabs.toArray()[index];
    }
    return event;
  }
}
