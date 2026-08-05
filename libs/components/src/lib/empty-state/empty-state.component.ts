import { Component, input, ViewEncapsulation } from '@angular/core';

/**
 * A placeholder for a section or page that currently has nothing to show - no results, an empty
 * list, a not-yet-configured feature. Project an icon via `[etIcon]`, set `title`/`description`,
 * and project an action (e.g. a button) via `[etEmptyStateAction]`.
 *
 * @example
 * <et-empty-state heading="No results" description="Try a different search term.">
 *   <i etIcon="et-file"></i>
 *   <button et-button etEmptyStateAction type="button">Clear filters</button>
 * </et-empty-state>
 */
@Component({
  selector: 'et-empty-state',
  template: `
    <ng-content select="[etIcon]" />

    @if (heading(); as heading) {
      <p class="et-empty-state-title">{{ heading }}</p>
    }

    @if (description(); as description) {
      <p class="et-empty-state-description">{{ description }}</p>
    }

    <ng-content select="[etEmptyStateAction]" />
  `,
  styleUrl: './empty-state.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-empty-state',
  },
})
export class EmptyStateComponent {
  public heading = input<string>();
  public description = input<string>();
}
