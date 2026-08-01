import { Directive } from '@angular/core';

/**
 * Marks projected content as the table's full-width footer slot - a region rendered below the grid
 * and pinned to the bottom of the table's own scroll viewport. The table bakes in no pager; drop your
 * own controls here (e.g. `<et-pagination>` plus a page-size `<et-select>`).
 *
 * @example
 * <et-table [data]="rows()" [columns]="columns">
 *   <div etTableFooter>
 *     <et-pagination [(page)]="page" [totalPages]="totalPages()" />
 *   </div>
 * </et-table>
 */
@Directive({
  selector: '[etTableFooter]',
})
export class TableFooterDirective {}
