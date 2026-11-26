import { Component, ViewEncapsulation } from '@angular/core';
import { TABLE_GROUP_HEADERS_IMPORTS, TABLE_IMPORTS, TableColumns } from '@ethlete/components';
import { Player, PLAYERS } from './table-grouped-headers.data';

@Component({
  selector: 'app-table-grouped-headers-example',
  template: `<et-table [data]="PLAYERS" [columns]="COLUMNS" [rowKey]="rowKey" etTableGroupHeaders />`,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_GROUP_HEADERS_IMPORTS],
})
export class TableGroupedHeadersExampleComponent {
  protected readonly PLAYERS = PLAYERS;

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (player) => player.name },
    gp: { header: 'GP', value: (player) => player.gp, sortable: true, group: 'Season 24/25' },
    pts: { header: 'PTS', value: (player) => player.pts, sortable: true, group: 'Season 24/25' },
    ast: { header: 'AST', value: (player) => player.ast, sortable: true, group: 'Season 24/25' },
  } satisfies TableColumns<Player>;

  protected rowKey(player: Player) {
    return player.id;
  }
}
