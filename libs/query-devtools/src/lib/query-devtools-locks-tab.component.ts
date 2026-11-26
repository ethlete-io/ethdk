import { Component, ViewEncapsulation } from '@angular/core';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { DevtoolsLockKind } from './query-devtools-locks';

const KIND_LABELS: Record<DevtoolsLockKind, string> = {
  auth: 'Auth',
  poll: 'Polling',
  other: 'Other',
};

/**
 * The Locks tab: the Web Locks held across this origin, which is the one view in the panel that shows
 * something outside its own tab.
 */
@Component({
  selector: 'et-query-devtools-locks-tab',
  templateUrl: './query-devtools-locks-tab.component.html',
  styleUrl: './query-devtools-locks-tab.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsLocksTabComponent {
  protected host = injectQueryDevtoolsHost();

  protected kindLabel(kind: DevtoolsLockKind) {
    return KIND_LABELS[kind];
  }
}
