import { Component, input, ViewEncapsulation } from '@angular/core';
import { RouteSegment } from './query-devtools-types';

/**
 * A route with its path params and query string picked out from the static path. The segments render
 * element-only: a text node between them would render as a space inside the route.
 */
@Component({
  selector: 'et-query-devtools-route',
  template: `
    @for (segment of segments(); track $index) {
      <span [class]="'et-query-devtools-route-' + segment.kind" [attr.title]="segment.name">{{ segment.text }}</span>
    } @empty {
      {{ fallback() }}
    }
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsRouteComponent {
  public segments = input.required<RouteSegment[]>();
  public fallback = input('—');
}
