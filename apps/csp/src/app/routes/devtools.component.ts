import { Component, ViewEncapsulation } from '@angular/core';
import { QueryDevtoolsLazyComponent } from '@ethlete/query-devtools/lazy';

@Component({
  selector: 'app-devtools',
  template: '<p data-testid="devtools-route">Query devtools</p><et-query-devtools-lazy />',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsLazyComponent],
})
export class DevtoolsRouteComponent {}
