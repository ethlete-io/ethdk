import { A11yModule, FocusOrigin } from '@angular/cdk/a11y';
import { BooleanInput, NumberInput, coerceBooleanProperty, coerceNumberProperty } from '@angular/cdk/coercion';
import { PortalModule } from '@angular/cdk/portal';
import { NgClass, NgForOf, NgIf } from '@angular/common';
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
  TrackByFunction,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgClassType, TypedQueryList } from '@ethlete/core';
import { Subscription, merge, startWith } from 'rxjs';
import {
  InlineTabBodyComponent,
  InlineTabComponent,
  InlineTabHeaderComponent,
  InlineTabLabelWrapperDirective,
  TAB_GROUP,
} from '../../partials';

let nextId = 0;

export class InlineTabChangeEvent {
  index!: number;
  tab!: InlineTabComponent;
}

interface InlineTabsBaseHeader {
  _alignInkBarToSelectedTab(): void;
  updatePagination(): void;
  focusIndex: number;
}

@Component({
  selector: 'et-inline-tabs',
  templateUrl: 'inline-tabs.component.html',
  styleUrls: ['inline-tabs.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  providers: [
    {
      provide: TAB_GROUP,
      useExisting: InlineTabsComponent,
    },
  ],
  standalone: true,
  imports: [
    NgForOf,
    NgIf,
    InlineTabHeaderComponent,
    NgClass,
    InlineTabLabelWrapperDirective,
    A11yModule,
    InlineTabBodyComponent,
    PortalModule,
  ],
  host: {
    class: 'et-inline-tabs',
  },
})
export class InlineTabsComponent implements AfterContentInit, AfterContentChecked, OnDestroy {
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

  @Input()
  itemSize: 'auto' | 'same' = 'auto';

  @Input()
  scrollableClass?: NgClassType;

  @Input()
  get renderMasks(): boolean {
    return this._renderMasks;
  }
  set renderMasks(value: BooleanInput) {
    this._renderMasks = coerceBooleanProperty(value);
  }
  private _renderMasks = true;

  @Input()
  get renderButtons(): boolean {
    return this._renderButtons;
  }
  set renderButtons(value: BooleanInput) {
    this._renderButtons = coerceBooleanProperty(value);
  }
  private _renderButtons = true;

  @Input()
  get renderScrollbars(): boolean {
    return this._renderScrollbars;
  }
  set renderScrollbars(value: BooleanInput) {
    this._renderScrollbars = coerceBooleanProperty(value);
  }
  private _renderScrollbars = false;

  @Output()
  readonly selectedIndexChange = new EventEmitter<number>();

  @Output()
  readonly focusChange = new EventEmitter<InlineTabChangeEvent>();

  @Output()
  readonly selectedTabChange = new EventEmitter<InlineTabChangeEvent>(true);

  @ContentChildren(InlineTabComponent, { descendants: true })
  _allTabs!: TypedQueryList<InlineTabComponent>;

  @ViewChild('tabBodyWrapper')
  _tabBodyWrapper!: ElementRef;

  @ViewChild('tabHeader')
  _tabHeader!: InlineTabsBaseHeader;

  _tabs: TypedQueryList<InlineTabComponent> = new TypedQueryList<InlineTabComponent>();

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
        let selectedTab: InlineTabComponent | undefined;

        for (let i = 0; i < tabs.length; i++) {
          if (tabs[i]?.isActive) {
            this._indexToSelect = this._selectedIndex = i;
            this._lastFocusedTabIndex = null;
            selectedTab = tabs[i];
            break;
          }
        }

        if (!selectedTab && tabs[indexToSelect]) {
          Promise.resolve().then(() => {
            const t = tabs[indexToSelect];

            if (!t) return;

            t.isActive = true;
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
        this._tabs
          .filter((t): t is InlineTabComponent => !!t)
          .forEach((tab, index) => (tab.isActive = index === indexToSelect));

        if (!isFirstRun) {
          this.selectedIndexChange.emit(indexToSelect);
          this._tabBodyWrapper.nativeElement.style.minHeight = '';
        }
      });
    }

    this._tabs.forEach((tab, index) => {
      if (!tab) return;

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

  trackByTabFn: TrackByFunction<InlineTabComponent> = (index) => index;

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
    return `et-inline-tab-label-${this._groupId}-${i}`;
  }

  _getTabContentId(i: number): string {
    return `et-inline-tab-content-${this._groupId}-${i}`;
  }

  _handleClick(tab: InlineTabComponent, tabHeader: InlineTabsBaseHeader, index: number) {
    if (!tab.disabled) {
      this.selectedIndex = tabHeader.focusIndex = index;
    }
  }

  _getTabIndex(tab: InlineTabComponent, index: number): number | null {
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
    this._allTabs.changes.pipe(startWith(this._allTabs)).subscribe((tabs) => {
      this._tabs.reset(
        tabs
          .filter((t): t is InlineTabComponent => !!t)
          .filter((tab) => {
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

    this._tabLabelSubscription = merge(
      ...this._tabs.filter((t): t is InlineTabComponent => !!t).map((tab) => tab._stateChanges),
    ).subscribe(() => this._cdr.markForCheck());
  }

  private _createChangeEvent(index: number): InlineTabChangeEvent {
    const event = new InlineTabChangeEvent();
    event.index = index;
    if (this._tabs && this._tabs.length) {
      const tab = this._tabs.toArray()[index];

      if (tab) {
        event.tab = tab;
      }
    }
    return event;
  }
}
