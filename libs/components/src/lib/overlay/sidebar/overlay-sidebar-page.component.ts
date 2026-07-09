import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { OverlayBodyComponent, OverlayBodyDividerType } from '../overlay-body.component';
import { OverlayHeaderDirective } from '../overlay-header.directive';
import { OverlayHeaderTemplateDirective } from '../overlay-header-template.directive';
import { OverlayMainDirective } from '../overlay-main.directive';

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
  imports: [OverlayHeaderDirective, OverlayBodyComponent, NgTemplateOutlet],
  hostDirectives: [OverlayMainDirective],
  host: {
    class: 'et-overlay-sidebar-page-host',
  },
})
export class OverlaySidebarPageComponent {
  public headerTemplate = input.required<OverlayHeaderTemplateDirective | null>();
  public bodyTemplate = input.required<TemplateRef<unknown> | null>();
  public pageDividers = input<OverlayBodyDividerType>(false);
}
