import { Component, ViewEncapsulation } from '@angular/core';
import { TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS, TableColumns } from '@ethlete/components';

type Row = { id: number; name: string };

@Component({
  selector: 'app-table',
  template: '<et-table class="app-table" [data]="rows" [columns]="columns" data-testid="table" etTableVirtualScroll />',
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS],
})
export class TableRouteComponent {
  protected rows: Row[] = Array.from({ length: 500 }, (_, id) => ({ id, name: `Row ${id}` }));
  protected columns = {
    id: { header: 'Id', value: (row: Row) => row.id },
    name: { header: 'Name', value: (row: Row) => row.name },
  } satisfies TableColumns<Row>;
}
