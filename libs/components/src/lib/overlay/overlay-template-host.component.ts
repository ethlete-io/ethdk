import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewEncapsulation,
  inject,
  input,
  signal,
} from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN, AnimatedLifecycleDirective } from '@ethlete/core';
import { OverlaySurfaceContext } from './headless/overlay-surface.directive';

@Component({
  selector: 'et-overlay-template-host',
  templateUrl: './overlay-template-host.component.html',
  styleUrl: './overlay-template-host.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  hostDirectives: [AnimatedLifecycleDirective],
  host: {
    class: 'et-overlay-template-host',
  },
})
export class OverlayTemplateHostComponent {
  private animatedLifecycleInstance = inject(ANIMATED_LIFECYCLE_TOKEN);

  protected template = input.required<TemplateRef<OverlaySurfaceContext>>();
  protected context = input.required<OverlaySurfaceContext>();

  public animatedLifecycle = signal(this.animatedLifecycleInstance);
}
