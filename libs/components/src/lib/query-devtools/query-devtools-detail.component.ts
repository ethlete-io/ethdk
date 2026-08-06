import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsEntry } from '@ethlete/query';
import { QueryDevtoolsFeaturesComponent } from './query-devtools-features.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';
import { QueryDevtoolsRouteComponent } from './query-devtools-route.component';
import { AnyQuery, DetailTab } from './query-devtools-types';

/**
 * The query detail: head, live progress, run/edit/force actions and the overview/history/data
 * sub-tabs. Rendered inline by the Queries tab and wrapped in `<et-query-devtools-drawer>` by every
 * other tab's split view - both read/write the same {@link QueryDevtoolsHost.detailTab} and JIT editor
 * state, so switching sub-tab in one instance is switching it everywhere, exactly as when this was one
 * component holding everything.
 */
@Component({
  selector: 'et-query-devtools-detail',
  templateUrl: './query-devtools-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsFeaturesComponent, QueryDevtoolsJsonComponent, QueryDevtoolsRouteComponent],
})
export class QueryDevtoolsDetailComponent {
  protected host = injectQueryDevtoolsHost();

  public sel = input.required<{ entry: QueryDevtoolsEntry; query: AnyQuery }>();

  /**
   * Whether this is a tombstone. Everything that would run, edit or force the query is hidden for one -
   * its handle is a frozen snapshot, so those actions have nothing to act on.
   */
  protected isGone = computed(() => !!this.sel().entry.destroyedAt);

  protected readonly detailTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
    { id: 'data', label: 'Data' },
  ] satisfies { id: DetailTab; label: string }[];
}
