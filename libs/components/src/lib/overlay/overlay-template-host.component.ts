import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, ViewEncapsulation, input } from '@angular/core';
import { OverlaySurfaceContext } from './headless/overlay-surface.directive';

@Component({
  selector: 'et-overlay-template-host',
  templateUrl: './overlay-template-host.component.html',
  styleUrl: './overlay-template-host.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  host: {
    class: 'et-overlay-template-host',
  },
})
export class OverlayTemplateHostComponent {
  protected template = input.required<TemplateRef<OverlaySurfaceContext>>();
  protected context = input.required<OverlaySurfaceContext>();
}
