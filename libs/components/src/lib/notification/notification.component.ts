import { ChangeDetectionStrategy, Component, ViewEncapsulation, afterNextRender, inject } from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN, AnimatedLifecycleDirective } from '@ethlete/core';
import { NotificationActionDirective } from './headless/notification-action.directive';
import { NotificationDismissDirective } from './headless/notification-dismiss.directive';
import { NotificationDirective } from './headless/notification.directive';

@Component({
  selector: 'et-notification',
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationActionDirective, NotificationDismissDirective],
  hostDirectives: [{ directive: NotificationDirective, inputs: ['ref'] }, AnimatedLifecycleDirective],
  host: {
    class: 'et-notification',
  },
})
export class NotificationComponent {
  protected notification = inject(NotificationDirective);

  private animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);

  constructor() {
    afterNextRender(() => {
      this.animatedLifecycle.enter();
    });
  }
}
