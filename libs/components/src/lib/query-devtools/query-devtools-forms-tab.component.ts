import { Component, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsDrawerComponent } from './query-devtools-drawer.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';
import { QueryDevtoolsRouteComponent } from './query-devtools-route.component';

/** The Forms tab: registered `createQueryForm()` handles, each expandable to its field table. */
@Component({
  selector: 'et-query-devtools-forms-tab',
  templateUrl: './query-devtools-forms-tab.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsDrawerComponent, QueryDevtoolsJsonComponent, QueryDevtoolsRouteComponent],
})
export class QueryDevtoolsFormsTabComponent {
  protected host = injectQueryDevtoolsHost();
}
