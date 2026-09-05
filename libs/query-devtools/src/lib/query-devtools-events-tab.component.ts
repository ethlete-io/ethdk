import { Component, computed, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsDrawerComponent } from './query-devtools-drawer.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { DESTROY_CAUSE_LABELS, EventLogItem, queryDevtoolsEventClients } from './query-devtools-types';

/** The Events tab: the rolling log of repository traffic, refreshes and secure unbinds. */
@Component({
  selector: 'et-query-devtools-events-tab',
  templateUrl: './query-devtools-events-tab.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsDrawerComponent],
})
export class QueryDevtoolsEventsTabComponent {
  protected host = injectQueryDevtoolsHost();

  /**
   * The event rows the log shows: the client picker and the errors-only toggle applied. Kept apart from
   * the full log so "Refetched by" and the session export keep reading all of it.
   */
  protected filteredEvents = computed(() => {
    const client = this.host.eventClient();
    const errorsOnly = this.host.eventErrorsOnly();
    const events = this.host.eventLog();

    if (!client && !errorsOnly) return events;

    return events.filter(
      (event) => (!client || event.client === client) && (!errorsOnly || event.type === 'request-error'),
    );
  });

  /** The clients the event log has rows from, as its picker offers them. */
  protected eventClients = computed(() => queryDevtoolsEventClients(this.host.eventLog(), this.host.eventClient()));

  protected isEventLogNarrowed = computed(() => !!this.host.eventClient() || this.host.eventErrorsOnly());

  protected clearEvents() {
    this.host.eventLog.set([]);
  }

  protected toggleEventErrorsOnly() {
    this.host.eventErrorsOnly.update((v) => !v);
  }

  protected clearEventFilters() {
    this.host.eventClient.set(null);
    this.host.eventErrorsOnly.set(false);
  }

  /**
   * Opens the query a row belongs to in this tab's own drawer, rather than jumping to the Queries tab -
   * the log is read by walking rows, and a jump ends that walk on every click.
   */
  protected selectEventRow(item: EventLogItem) {
    if (item.queryId) this.host.eventSelectedQueryId.set(item.queryId);
  }

  /**
   * Whether a row's query can still be opened. An id alone does not say so: a query batch destroys each
   * item's query as that item settles and leaves no tombstone behind, so a bulk run's rows would
   * otherwise all render as links that open nothing.
   */
  protected canOpenEventRow(id: string | null) {
    return !!id && !!this.host.findQuery(id);
  }

  /** Only a request settling is a success or a failure; a teardown or a refresh is neither. */
  protected eventRowStatus(event: EventLogItem) {
    if (event.type === 'request-error') return 'error';
    if (event.type === 'request-success') return 'success';

    return null;
  }

  protected eventTypeLabel(event: EventLogItem) {
    if (event.type === 'unbind-all-secure') return 'logout';
    if (event.type === 'queries-refreshed') return `refetch ×${event.refreshed?.length ?? 0}`;
    if (event.type === 'entry-destroyed') return `dropped · ${DESTROY_CAUSE_LABELS[event.destroyCause ?? 'unbind']}`;

    return event.type === 'request-error' ? `error ${event.status}` : 'success';
  }
}
