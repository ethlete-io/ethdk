import { Directionality } from '@angular/cdk/bidi';
import { _DisposeViewRepeaterStrategy, _VIEW_REPEATER_STRATEGY, _ViewRepeater } from '@angular/cdk/collections';
import { Platform } from '@angular/cdk/platform';
import { ViewportRuler } from '@angular/cdk/scrolling';
import {
  CDK_TABLE,
  CdkTable,
  CdkTableModule,
  RenderRow,
  RowContext,
  STICKY_POSITIONING_LISTENER,
  StickyPositioningListener,
  _COALESCED_STYLE_SCHEDULER,
  _CoalescedStyleScheduler,
} from '@angular/cdk/table';
import { DOCUMENT } from '@angular/common';
import {
  Attribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  ElementRef,
  HostBinding,
  Inject,
  Input,
  IterableDiffers,
  NgZone,
  OnInit,
  Optional,
  SkipSelf,
  ViewChild,
  ViewEncapsulation,
  booleanAttribute,
  inject,
} from '@angular/core';
import { TableBusyDirective, TableBusyOutletDirective } from '../../partials';

@Component({
  selector: 'et-table, table[et-table]',
  exportAs: 'etTable',
  template: `
    <ng-content select="caption" />
    <ng-content select="colgroup, col" />
    <ng-container headerRowOutlet />
    <div class="et-table-body">
      <ng-container rowOutlet />
      <ng-container tableBusyOutlet />
    </div>
    <ng-container noDataRowOutlet />
    <ng-container footerRowOutlet />
  `,
  styleUrls: ['table.component.scss'],
  host: {
    class: 'et-table et-data-table__table',
    '[class.et-table-fixed-layout]': 'fixedLayout',
  },
  providers: [
    { provide: CdkTable, useExisting: TableComponent },
    { provide: CDK_TABLE, useExisting: TableComponent },
    { provide: _COALESCED_STYLE_SCHEDULER, useClass: _CoalescedStyleScheduler },
    { provide: _VIEW_REPEATER_STRATEGY, useClass: _DisposeViewRepeaterStrategy },
    { provide: STICKY_POSITIONING_LISTENER, useValue: null },
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  standalone: true,
  imports: [CdkTableModule, TableBusyOutletDirective],
})
export class TableComponent<T> extends CdkTable<T> implements OnInit {
  private _cdr = inject(ChangeDetectorRef);

  protected override stickyCssClass = 'et-table-sticky';
  protected override needsPositionStickyOnElement = false;

  @ViewChild(TableBusyOutletDirective, { static: true })
  _tableBusyOutlet?: TableBusyOutletDirective;

  @ContentChild(TableBusyDirective)
  _tableBusyComponent?: TableBusyDirective;

  @Input()
  get busy(): boolean {
    return this._busy;
  }
  set busy(value: unknown) {
    this._busy = booleanAttribute(value);
    this._updateTableBusy();
  }
  private _busy = false;

  @HostBinding('attr.aria-busy')
  get _attrAriaBusy() {
    return this.busy ? true : null;
  }

  _isShowingTableBusy = false;

  constructor(
    _differs: IterableDiffers,
    _changeDetectorRef: ChangeDetectorRef,
    _elementRef: ElementRef,
    @Attribute('role') role: string,
    @Optional() _dir: Directionality,
    @Inject(DOCUMENT) _document: Document,
    _platform: Platform,
    @Inject(_VIEW_REPEATER_STRATEGY)
    _viewRepeater: _ViewRepeater<T, RenderRow<T>, RowContext<T>>,
    @Inject(_COALESCED_STYLE_SCHEDULER)
    _coalescedStyleScheduler: _CoalescedStyleScheduler,
    _viewportRuler: ViewportRuler,
    @Optional()
    @SkipSelf()
    @Inject(STICKY_POSITIONING_LISTENER)
    _stickyPositioningListener: StickyPositioningListener,
    _ngZone: NgZone,
  ) {
    super(
      _differs,
      _changeDetectorRef,
      _elementRef,
      role,
      _dir,
      _document,
      _platform,
      _viewRepeater,
      _coalescedStyleScheduler,
      _viewportRuler,
      _stickyPositioningListener,
      _ngZone,
    );
  }

  override ngOnInit() {
    super.ngOnInit();

    if (this._isNativeHtmlTable) {
      const tbody = this._elementRef.nativeElement.querySelector('tbody');
      tbody.classList.add('et-data-table__content');
    }
  }

  private _updateTableBusy() {
    const tableBusyComponent = this._tableBusyComponent;

    if (!tableBusyComponent) {
      return;
    }

    const shouldShow = this.busy;

    if (shouldShow === this._isShowingTableBusy) {
      return;
    }

    const container = this._tableBusyOutlet?.viewContainer;

    if (!container) {
      return;
    }

    if (shouldShow) {
      const view = container.createEmbeddedView(tableBusyComponent.templateRef);
      const rootNode: HTMLElement | undefined = view.rootNodes[0];

      if (view.rootNodes.length === 1 && rootNode?.nodeType === document.ELEMENT_NODE) {
        rootNode.classList.add(tableBusyComponent._contentClassName);
      }
    } else {
      container.clear();
    }

    this._isShowingTableBusy = shouldShow;
    this._cdr.markForCheck();
  }
}
