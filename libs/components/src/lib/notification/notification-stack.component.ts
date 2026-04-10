import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { NotificationItemDirective } from './headless/notification-item.directive';
import { NotificationStackDirective } from './headless/notification-stack.directive';
import { NotificationComponent } from './notification.component';

@Component({
  selector: 'et-notification-stack',
  templateUrl: './notification-stack.component.html',
  styleUrl: './notification-stack.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationComponent, NotificationItemDirective],
  hostDirectives: [NotificationStackDirective],
  host: {
    class: 'et-notification-stack',
  },
})
export class NotificationStackComponent {
  protected stackDirective = inject(NotificationStackDirective);
}
