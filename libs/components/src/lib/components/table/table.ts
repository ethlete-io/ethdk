import { ChangeDetectionStrategy, Component, Directive, OnInit, ViewEncapsulation } from '@angular/core';
import {
  CDK_TABLE_TEMPLATE,
  CdkTable,
  _CoalescedStyleScheduler,
  _COALESCED_STYLE_SCHEDULER,
  CDK_TABLE,
  STICKY_POSITIONING_LISTENER,
} from '@angular/cdk/table';
import {
  _DisposeViewRepeaterStrategy,
  _RecycleViewRepeaterStrategy,
  _VIEW_REPEATER_STRATEGY,
} from '@angular/cdk/collections';

@Directive({
  selector: 'et-table[recycleRows], table[et-table][recycleRows]',
  providers: [{ provide: _VIEW_REPEATER_STRATEGY, useClass: _RecycleViewRepeaterStrategy }],
})
export class RecycleRowsDirective {}

@Component({
  selector: 'et-table, table[et-table]',
  exportAs: 'etTable',
  template: CDK_TABLE_TEMPLATE,
  styleUrls: ['table.scss'],
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
})
export class TableComponent<T> extends CdkTable<T> implements OnInit {
  protected override stickyCssClass = 'et-table-sticky';

  protected override needsPositionStickyOnElement = false;

  override ngOnInit() {
    super.ngOnInit();

    if (this._isNativeHtmlTable) {
      const tbody = this._elementRef.nativeElement.querySelector('tbody');
      tbody.classList.add('et-data-table__content');
    }
  }
}
