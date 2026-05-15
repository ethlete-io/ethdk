import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN, AnimatedLifecycleDirective } from '@ethlete/core';
import { OverlaySurfaceContext } from './headless/overlay-surface.directive';
import { injectOverlayData } from './overlay-data';

export type OverlayTemplateHostData = {
  context: OverlaySurfaceContext;
  template: TemplateRef<OverlaySurfaceContext>;
};

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
  private data = injectOverlayData<OverlayTemplateHostData>();

  animatedLifecycle = signal(this.animatedLifecycleInstance);

  protected template = computed(() => this.data.template);
  protected context = computed(() => this.data.context);
}
