import { Component, ViewEncapsulation } from '@angular/core';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';

/** The Sockets tab: registered `WebSocketDevtoolsHandle`s, their rooms, and a message log per client. */
@Component({
  selector: 'et-query-devtools-sockets-tab',
  templateUrl: './query-devtools-sockets-tab.component.html',
  styleUrl: './query-devtools-sockets-tab.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsJsonComponent],
})
export class QueryDevtoolsSocketsTabComponent {
  protected host = injectQueryDevtoolsHost();
}
