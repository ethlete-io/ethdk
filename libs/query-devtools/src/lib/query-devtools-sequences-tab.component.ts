import { Component, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsDrawerComponent } from './query-devtools-drawer.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';
import { QueryDevtoolsRouteComponent } from './query-devtools-route.component';

/** The Sequences tab: registered `QuerySequence` instances, step-by-step, with a split-view drawer. */
@Component({
  selector: 'et-query-devtools-sequences-tab',
  templateUrl: './query-devtools-sequences-tab.component.html',
  styleUrl: './query-devtools-sequences-tab.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsDrawerComponent, QueryDevtoolsJsonComponent, QueryDevtoolsRouteComponent],
})
export class QueryDevtoolsSequencesTabComponent {
  protected host = injectQueryDevtoolsHost();
}
