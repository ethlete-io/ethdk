import { ChangeDetectionStrategy, Component, ViewChild, ViewEncapsulation } from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN, AnimatedLifecycleDirective } from '@ethlete/core';

@Component({
  selector: 'et-select-body',
  template: `<div class="et-select-body-container" etAnimatedLifecycle><h1>body</h1></div>`,
  styleUrls: ['./select-body.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select-body et-with-default-animation',
  },
  imports: [AnimatedLifecycleDirective],
  hostDirectives: [],
})
export class SelectBodyComponent {
  @ViewChild(ANIMATED_LIFECYCLE_TOKEN, { static: true })
  readonly _animatedLifecycle?: AnimatedLifecycleDirective;
}
