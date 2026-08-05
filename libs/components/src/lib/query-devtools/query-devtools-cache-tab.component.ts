import { Component, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsFeaturesComponent } from './query-devtools-features.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';

/** The Cache tab: every client's cache entries, their freshness, sync status and disk persistence. */
@Component({
  selector: 'et-query-devtools-cache-tab',
  templateUrl: './query-devtools-cache-tab.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsFeaturesComponent, QueryDevtoolsJsonComponent],
})
export class QueryDevtoolsCacheTabComponent {
  protected host = injectQueryDevtoolsHost();
}
