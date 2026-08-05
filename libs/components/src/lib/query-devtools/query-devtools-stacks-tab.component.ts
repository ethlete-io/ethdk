import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { AnyPagedQueryStack, AnyQueryStack } from '@ethlete/query';
import { QueryDevtoolsDrawerComponent } from './query-devtools-drawer.component';
import { QueryDevtoolsFeaturesComponent } from './query-devtools-features.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsRouteComponent } from './query-devtools-route.component';

/** The Stacks tab: registered `QueryStack`/`PagedQueryStack` instances, each with a split-view drawer. */
@Component({
  selector: 'et-query-devtools-stacks-tab',
  templateUrl: './query-devtools-stacks-tab.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgTemplateOutlet,
    QueryDevtoolsDrawerComponent,
    QueryDevtoolsFeaturesComponent,
    QueryDevtoolsRouteComponent,
  ],
})
export class QueryDevtoolsStacksTabComponent {
  protected host = injectQueryDevtoolsHost();

  /** Identifying info for a stack, derived from its (uniform) inner queries. */
  protected stackIdentity(stack: AnyQueryStack | AnyPagedQueryStack) {
    const first = this.host.queriesForStack(stack)[0];

    return { method: first?.method ?? '', segments: first?.segments ?? [], baseUrl: first?.clientBaseUrl ?? '' };
  }
}
