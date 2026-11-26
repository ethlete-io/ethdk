import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import {
  OverlayBodyComponent,
  OverlayBodyDividerType,
  OverlayHeaderDirective,
  OverlayHeaderTemplateDirective,
  OverlayMainDirective,
} from '../common';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-overlay-sidebar-page',
  template: `
    @if (headerTemplate()?.template; as tpl) {
      <et-overlay-header>
        <ng-container *ngTemplateOutlet="tpl" />
      </et-overlay-header>
    }

    <et-overlay-body [dividers]="pageDividers()">
      <ng-container *ngTemplateOutlet="bodyTemplate()" />
    </et-overlay-body>
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-overlay-sidebar-page-host et-legacy',
  },
  imports: [OverlayHeaderDirective, OverlayBodyComponent, NgTemplateOutlet],
  hostDirectives: [OverlayMainDirective],
})
export class OverlaySidebarPageComponent {
  headerTemplate = input.required<OverlayHeaderTemplateDirective | null>();
  bodyTemplate = input.required<TemplateRef<unknown> | null>();
  pageDividers = input<OverlayBodyDividerType>(false);
}
