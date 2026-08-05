import { Component, computed, ViewEncapsulation } from '@angular/core';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { EventLogItem } from './query-devtools-types';

/** The Events tab: the rolling log of repository traffic, refreshes and secure unbinds. */
@Component({
  selector: 'et-query-devtools-events-tab',
  templateUrl: './query-devtools-events-tab.component.html',
  encapsulation: ViewEncapsulation.None,
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
  protected eventClients = computed(() => {
    const names = new Set(this.host.repositories().map(({ name, baseUrl }) => baseUrl || name));

    return Array.from(names).sort();
  });

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

  protected selectEventRow(item: EventLogItem) {
    if (item.queryId) this.host.selectQuery(item.queryId);
  }

  protected eventTypeLabel(event: EventLogItem) {
    if (event.type === 'unbind-all-secure') return 'logout';
    if (event.type === 'queries-refreshed') return `refetch ×${event.refreshed?.length ?? 0}`;

    return event.type === 'request-error' ? `error ${event.status}` : 'success';
  }
}
