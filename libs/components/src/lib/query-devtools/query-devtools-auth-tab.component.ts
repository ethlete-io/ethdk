import { Component, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsFeaturesComponent } from './query-devtools-features.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';

/** The Auth tab: registered bearer auth providers, their tokens and their internal queries. */
@Component({
  selector: 'et-query-devtools-auth-tab',
  templateUrl: './query-devtools-auth-tab.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsFeaturesComponent, QueryDevtoolsJsonComponent],
})
export class QueryDevtoolsAuthTabComponent {
  protected host = injectQueryDevtoolsHost();
}
