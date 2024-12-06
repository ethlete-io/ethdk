import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { OverlayBodyComponent, OverlayBodyDividerType } from '../overlay-body';
import { OverlayHeaderDirective } from '../overlay-header';
import { OverlayHeaderTemplateDirective } from '../overlay-header-template';
import { OverlayMainDirective } from '../overlay-main';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-overlay-sidebar-page-host',
  },
  imports: [OverlayHeaderDirective, OverlayBodyComponent, NgTemplateOutlet],
  hostDirectives: [OverlayMainDirective],
})
export class OverlaySidebarPageComponent {
  headerTemplate = input.required<OverlayHeaderTemplateDirective | null>();
  bodyTemplate = input.required<TemplateRef<unknown> | null>();
  pageDividers = input<OverlayBodyDividerType>(false);
}
