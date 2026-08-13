import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { AnyQueryBatchItemResult } from '@ethlete/query';
import { QueryDevtoolsDrawerComponent } from './query-devtools-drawer.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';
import { QueryDevtoolsRouteComponent } from './query-devtools-route.component';
import { QueryDevtoolsStepStylesComponent } from './query-devtools-step-styles.component';

/** The Batches tab: registered `createQueryBatch` runs, their progress and every item's outcome. */
@Component({
  selector: 'et-query-devtools-batches-tab',
  templateUrl: './query-devtools-batches-tab.component.html',
  styleUrl: './query-devtools-batches-tab.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsDrawerComponent, QueryDevtoolsJsonComponent, QueryDevtoolsRouteComponent],
})
export class QueryDevtoolsBatchesTabComponent {
  protected host = injectQueryDevtoolsHost();

  constructor() {
    injectStyleManager().mount(QueryDevtoolsStepStylesComponent);
  }

  /**
   * The dot an item's outcome gets. Skipped and not-attempted items share the neutral one: neither
   * reached the API, and a red dot for either would read as something the run has to recover from.
   */
  protected itemStatus(result: AnyQueryBatchItemResult) {
    return result.status === 'success' || result.status === 'error' ? result.status : null;
  }

  /** Whether the item was actually sent, which is what decides it has an in/out worth rendering. */
  protected wasSent(result: AnyQueryBatchItemResult) {
    return result.status === 'success' || result.status === 'error';
  }

  protected itemArgs(result: AnyQueryBatchItemResult) {
    return this.wasSent(result) ? (result as { args: unknown }).args : null;
  }

  protected itemResponse(result: AnyQueryBatchItemResult) {
    return result.status === 'success' ? result.response : null;
  }

  /** The error body of a failed item, as the value explorer wants it. */
  protected itemError(result: AnyQueryBatchItemResult) {
    if (result.status !== 'error') return null;

    return { status: result.error.raw.status, body: result.error.isList ? result.error.errors : result.error.error };
  }
}
