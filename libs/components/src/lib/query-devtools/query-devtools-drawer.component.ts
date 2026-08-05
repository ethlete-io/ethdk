import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsEntry } from '@ethlete/query';
import { QueryDevtoolsDetailComponent } from './query-devtools-detail.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { AnyQuery } from './query-devtools-types';

/**
 * The split-view drawer every two-pane tab (stacks/sequences/forms/timeline) opens a query in - the
 * resize handle, the `<aside>` chrome and the close button around a `<et-query-devtools-detail>`. The
 * Queries tab renders that same detail component inline instead, without this wrapper, since it has no
 * separate list/drawer split to close.
 */
@Component({
  selector: 'et-query-devtools-drawer',
  templateUrl: './query-devtools-drawer.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsDetailComponent],
})
export class QueryDevtoolsDrawerComponent {
  protected host = injectQueryDevtoolsHost();

  public sel = input<{ entry: QueryDevtoolsEntry; query: AnyQuery } | null>(null);
  public container = input.required<HTMLElement>();

  public dismiss = output<void>();
}
