import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { RouteSegment } from './query-devtools-types';

/**
 * Drops a leading path prefix from a route's segments, splitting whichever segment the prefix ends
 * inside. `null` when the route does not start with the prefix - a caller then shows the whole route
 * rather than a tail that would start mid-token and read as a different endpoint.
 */
export const trimRouteSegments = (segments: readonly RouteSegment[], prefix: string): RouteSegment[] | null => {
  if (!prefix) return null;
  if (
    !segments
      .map((segment) => segment.text)
      .join('')
      .startsWith(prefix)
  )
    return null;

  let remaining = prefix.length;

  const trimmed: RouteSegment[] = [];

  for (const segment of segments) {
    if (remaining <= 0) {
      trimmed.push(segment);
      continue;
    }

    if (segment.text.length <= remaining) {
      remaining -= segment.text.length;
      continue;
    }

    trimmed.push({ ...segment, text: segment.text.slice(remaining) });
    remaining = 0;
  }

  return trimmed.length ? trimmed : null;
};

/**
 * A route with its path params and query string picked out from the static path. The segments render
 * element-only: a text node between them would render as a space inside the route.
 */
@Component({
  selector: 'et-query-devtools-route',
  template: `
    @if (trimmed(); as trimmed) {
      <span [attr.title]="trimTitle()" class="et-query-devtools-route-trimmed">…</span>
      @for (segment of trimmed; track $index) {
        <span [class]="'et-query-devtools-route-' + segment.kind" [attr.title]="segment.name">{{ segment.text }}</span>
      }
    } @else {
      @for (segment of segments(); track $index) {
        <span [class]="'et-query-devtools-route-' + segment.kind" [attr.title]="segment.name">{{ segment.text }}</span>
      } @empty {
        {{ fallback() }}
      }
    }
  `,
  styleUrl: './query-devtools-route.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsRouteComponent {
  public segments = input.required<RouteSegment[]>();
  public fallback = input('—');

  /**
   * A leading path the row's surroundings already state - the tree's folder heading. Rendering it again
   * on every child is noise, so it is replaced by a `…` that carries the full route in its `title`.
   */
  public trimPrefix = input('');

  protected trimmed = computed(() => trimRouteSegments(this.segments(), this.trimPrefix()));

  protected trimTitle = computed(
    () =>
      `${this.trimPrefix()}… — ${this.segments()
        .map((s) => s.text)
        .join('')}`,
  );
}
