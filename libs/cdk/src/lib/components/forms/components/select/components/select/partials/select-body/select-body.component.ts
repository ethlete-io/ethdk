import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN, AnimatedLifecycleDirective } from '@ethlete/core';
import { SELECT_BODY_TOKEN, SelectBodyDirective } from '../../directives';

@Component({
  selector: 'et-select-body',
  template: `
    <div class="et-select-body-container" etAnimatedLifecycle>
      <ng-container [ngTemplateOutlet]="_bodyTemplate" />
    </div>
  `,
  styleUrls: ['./select-body.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select-body et-with-default-animation',
  },
  imports: [AnimatedLifecycleDirective, NgTemplateOutlet],
  hostDirectives: [SelectBodyDirective],
})
export class SelectBodyComponent {
  readonly selectBody = inject(SELECT_BODY_TOKEN);

  @ViewChild(ANIMATED_LIFECYCLE_TOKEN, { static: true })
  readonly _animatedLifecycle?: AnimatedLifecycleDirective;

  _bodyTemplate: TemplateRef<unknown> | null = null;
}
