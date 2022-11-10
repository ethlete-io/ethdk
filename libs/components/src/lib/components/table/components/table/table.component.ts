import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { _DisposeViewRepeaterStrategy, _VIEW_REPEATER_STRATEGY } from '@angular/cdk/collections';
import {
  CdkTable,
  CdkTableModule,
  CDK_TABLE,
  STICKY_POSITIONING_LISTENER,
  _CoalescedStyleScheduler,
  _COALESCED_STYLE_SCHEDULER,
} from '@angular/cdk/table';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  HostBinding,
  inject,
  Input,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { TableBusyDirective, TableBusyOutletDirective } from '../../partials';

@Component({
  selector: 'et-table, table[et-table]',
  exportAs: 'etTable',
  template: `
    <ng-content select="caption"></ng-content>
    <ng-content select="colgroup, col"></ng-content>
    <ng-container headerRowOutlet></ng-container>
    <div class="et-table-body">
      <ng-container rowOutlet></ng-container>
      <ng-container tableBusyOutlet></ng-container>
    </div>
    <ng-container noDataRowOutlet></ng-container>
    <ng-container footerRowOutlet></ng-container>
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
  set busy(value: BooleanInput) {
    this._busy = coerceBooleanProperty(value);
    this._updateTableBusy();
  }
  private _busy = false;

  @HostBinding('attr.aria-busy')
  get _attrAriaBusy() {
    return this.busy ? true : null;
  }

  _isShowingTableBusy = false;

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
