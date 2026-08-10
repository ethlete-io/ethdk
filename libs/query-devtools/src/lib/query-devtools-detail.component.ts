import { Component, computed, input, signal, ViewEncapsulation } from '@angular/core';
import { MenuComponent, MenuItemComponent, MenuSeparatorComponent } from '@ethlete/components';
import { MenuDirective, MenuSurfaceDirective, MenuTriggerDirective } from '@ethlete/components';
import { QueryDevtoolsFeaturesComponent } from './query-devtools-features.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';
import { QueryDevtoolsOverrideSetMenuComponent } from './query-devtools-override-set-menu.component';
import { QueryDevtoolsRouteComponent } from './query-devtools-route.component';
import { DetailTab, QueryDevtoolsSelection } from './query-devtools-types';

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
  styleUrl: './query-devtools-detail.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MenuComponent,
    MenuDirective,
    MenuItemComponent,
    MenuSeparatorComponent,
    MenuSurfaceDirective,
    MenuTriggerDirective,
    QueryDevtoolsFeaturesComponent,
    QueryDevtoolsJsonComponent,
    QueryDevtoolsOverrideSetMenuComponent,
    QueryDevtoolsRouteComponent,
  ],
})
export class QueryDevtoolsDetailComponent {
  protected host = injectQueryDevtoolsHost();

  public sel = input.required<QueryDevtoolsSelection>();

  /** Whether any of the three exports behind the Copy menu has just landed on the clipboard. */
  protected copied = computed(() => this.host.copiedReport() || this.host.copiedCurl() || this.host.copiedInsomnia());

  protected overrideSetSource = computed(() => {
    const sel = this.sel();
    const url = this.host.requestUrl(sel.query);

    return { id: sel.entry.id, ...(url ? { url } : {}) };
  });

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

  /** Whether the tail of runs that can no longer be diffed is unfolded. */
  protected foldedRunsOpen = signal(false);

  /**
   * The runs split at the last one that still holds a body. Only the newest few can ever be an end of a
   * diff (`setQueryDevtoolsResponseHistory`, five by default) while the run log keeps twenty-five, so
   * without this the diff sits under twenty rows reading `body no longer held` and the pair and its
   * result never fit on one screen.
   *
   * Split, not filtered: a dead row *between* two live ones stays where it is, so the log keeps its order.
   */
  protected runSections = computed(() => {
    const runs = this.host.queryRuns(this.sel().entry);
    const isActionable = (run: (typeof runs)[number]) => run.hasResponse || !!run.error?.hasBody;

    let lastActionable = -1;
    runs.forEach((run, index) => {
      if (isActionable(run)) lastActionable = index;
    });

    return { listed: runs.slice(0, lastActionable + 1), folded: runs.slice(lastActionable + 1) };
  });

  /** What a run's Diff button reads as at each end of the comparison. */
  protected readonly diffRoles = {
    base: {
      label: 'Base',
      title: 'The older end of the comparison - click another run to set the newer one, or this one to clear it',
    },
    compare: { label: 'Compare', title: 'The newer end of the comparison - click to clear it' },
  } satisfies Record<'base' | 'compare', { label: string; title: string }>;
}
