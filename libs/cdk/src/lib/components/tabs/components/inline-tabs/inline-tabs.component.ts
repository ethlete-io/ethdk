import { A11yModule, FocusOrigin } from '@angular/cdk/a11y';
import { PortalModule } from '@angular/cdk/portal';
import { NgClass } from '@angular/common';
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
  booleanAttribute,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { NgClassType, TypedQueryList } from '@ethlete/core';
import { Subscription, merge, startWith } from 'rxjs';
import { ScrollableDirection } from '../../../scrollable/components/scrollable';
import { InlineTabComponent, TAB_GROUP } from '../../partials/inline-tabs/inline-tab';
import { InlineTabBodyComponent } from '../../partials/inline-tabs/inline-tab-body';
import { InlineTabHeaderComponent } from '../../partials/inline-tabs/inline-tab-header';
import { InlineTabLabelWrapperDirective } from '../../partials/inline-tabs/inline-tab-label-wrapper';

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
  imports: [
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
  private _cdr = inject(ChangeDetectorRef);

  @Input({ transform: numberAttribute })
  selectedIndex: number | null = null;

  @Input({ transform: numberAttribute })
  contentTabIndex: number | null = null;

  @Input({ transform: booleanAttribute })
  preserveContent = false;

  @Input()
  tabHeaderClasses: NgClassType;

  @Input()
  itemSize: 'auto' | 'same' = 'auto';

  @Input()
  scrollableClass?: NgClassType;

  @Input({ transform: booleanAttribute })
  renderMasks = true;

  @Input({ transform: booleanAttribute })
  renderButtons = true;

  @Input({ transform: booleanAttribute })
  renderScrollbars = false;

  direction = input<ScrollableDirection>('horizontal');

  @Output()
  readonly selectedIndexChange = new EventEmitter<number>();

  @Output()
  readonly focusChange = new EventEmitter<InlineTabChangeEvent>();

  @Output()
  readonly selectedTabChange = new EventEmitter<InlineTabChangeEvent>(true);

  @ContentChildren(InlineTabComponent, { descendants: true })
  _allTabs!: TypedQueryList<InlineTabComponent>;

  @ViewChild('tabBodyWrapper')
  _tabBodyWrapper: ElementRef<HTMLElement> | null = null;

  @ViewChild('tabHeader')
  _tabHeader!: InlineTabsBaseHeader;

  _tabs: TypedQueryList<InlineTabComponent> = new TypedQueryList<InlineTabComponent>();

  private _groupId = nextId++;
  private _lastFocusedTabIndex: number | null = null;
  private _tabsSubscription = Subscription.EMPTY;
  private _tabLabelSubscription = Subscription.EMPTY;

  ngAfterContentInit() {
    this._subscribeToAllTabChanges();
    this._subscribeToTabLabels();

    this._tabsSubscription = this._tabs.changes.subscribe(() => {
      const indexToSelect = this._clampTabIndex(this.selectedIndex);

      if (indexToSelect === this.selectedIndex) {
        const tabs = this._tabs.toArray();
        let selectedTab: InlineTabComponent | undefined;

        for (let i = 0; i < tabs.length; i++) {
          if (tabs[i]?.isActive) {
            this.selectedIndex = i;
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
            this.selectedIndexChange.emit(indexToSelect);
          });
        }
      }

      this._cdr.markForCheck();
    });
  }

  ngAfterContentChecked() {
    const indexToSelect = (this.selectedIndex = this._clampTabIndex(this.selectedIndex));

    if (this.selectedIndex != indexToSelect && this._tabBodyWrapper) {
      const isFirstRun = this.selectedIndex == null;

      if (!isFirstRun) {
        this.selectedTabChange.emit(this._createChangeEvent(indexToSelect));

        const wrapper = this._tabBodyWrapper?.nativeElement;
        wrapper.style.minHeight = wrapper.clientHeight + 'px';
      }

      Promise.resolve().then(() => {
        this._tabs
          .filter((t): t is InlineTabComponent => !!t)
          .forEach((tab, index) => (tab.isActive = index === indexToSelect));

        if (!isFirstRun) {
          this.selectedIndexChange.emit(indexToSelect);

          if (this._tabBodyWrapper) {
            this._tabBodyWrapper.nativeElement.style.minHeight = '';
          }
        }
      });
    }

    this._tabs.forEach((tab, index) => {
      if (!tab) return;

      tab.position = index - indexToSelect;

      if (this.selectedIndex != null && tab.position == 0 && !tab.origin) {
        tab.origin = indexToSelect - this.selectedIndex;
      }
    });

    if (this.selectedIndex !== indexToSelect) {
      this.selectedIndex = indexToSelect;
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
    if (!tab.disabled && this.selectedIndex !== index) {
      this.selectedIndex = tabHeader.focusIndex = index;
      this.selectedIndexChange.emit(index);
      this.selectedTabChange.emit(this._createChangeEvent(index));
    }
  }

  _handleEnter(index: number) {
    const tab = this._tabs.toArray()[index];
    if (!tab || tab.disabled || this.selectedIndex === index) return;

    this.selectedIndex = index;
    this.selectedIndexChange.emit(index);
    this.selectedTabChange.emit(this._createChangeEvent(index));
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
