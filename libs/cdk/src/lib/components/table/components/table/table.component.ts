import { _DisposeViewRepeaterStrategy, _VIEW_REPEATER_STRATEGY } from '@angular/cdk/collections';
import {
  CDK_TABLE,
  CdkTable,
  DataRowOutlet,
  FooterRowOutlet,
  HeaderRowOutlet,
  NoDataRowOutlet,
  STICKY_POSITIONING_LISTENER,
} from '@angular/cdk/table';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  ViewEncapsulation,
  booleanAttribute,
  inject,
  viewChild,
  contentChild
} from '@angular/core';
import { TableBusyDirective } from '../../partials/table-busy';
import { TableBusyOutletDirective } from '../../partials/table-busy-outlet';

@Component({
  selector: 'et-table, table[et-table]',
  exportAs: 'etTable',
  template: `
    <ng-content select="caption" />
    <ng-content select="colgroup, col" />

    @if (_isServer) {
      <ng-content />
    }

    @if (_isNativeHtmlTable) {
      <thead role="rowgroup">
        <ng-container headerRowOutlet />
      </thead>
      <tbody class="mdc-data-table__content" role="rowgroup">
        <ng-container rowOutlet />
        <ng-container noDataRowOutlet />
      </tbody>
      <tfoot role="rowgroup">
        <ng-container footerRowOutlet />
      </tfoot>
    } @else {
      <ng-container headerRowOutlet />
      <div class="et-table-body">
        <ng-container rowOutlet />
        <ng-container tableBusyOutlet />
      </div>
      <ng-container noDataRowOutlet />
      <ng-container footerRowOutlet />
    }
  `,
  styleUrls: ['table.component.scss'],
  host: {
    class: 'et-table et-data-table__table',
    '[class.et-table-fixed-layout]': 'fixedLayout',
  },
  providers: [
    { provide: CdkTable, useExisting: TableComponent },
    { provide: CDK_TABLE, useExisting: TableComponent },
    { provide: _VIEW_REPEATER_STRATEGY, useClass: _DisposeViewRepeaterStrategy },
    { provide: STICKY_POSITIONING_LISTENER, useValue: null },
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [HeaderRowOutlet, DataRowOutlet, NoDataRowOutlet, FooterRowOutlet, TableBusyOutletDirective],
})
export class TableComponent<T> extends CdkTable<T> implements AfterContentInit {
  private _cdr = inject(ChangeDetectorRef);

  protected override stickyCssClass = 'et-table-sticky';
  protected override needsPositionStickyOnElement = false;

  readonly _tableBusyOutlet = viewChild(TableBusyOutletDirective);

  readonly _tableBusyComponent = contentChild(TableBusyDirective);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
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

  override ngAfterContentInit() {
    super.ngAfterContentInit();

    this._updateTableBusy();
  }

  private _updateTableBusy() {
    const tableBusyComponent = this._tableBusyComponent();

    if (!tableBusyComponent) {
      return;
    }

    const shouldShow = this.busy;

    if (shouldShow === this._isShowingTableBusy) {
      return;
    }

    const container = this._tableBusyOutlet()?.viewContainer;

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
