import { NotificationActionDirective } from './headless/notification-action.directive';
import { NotificationDismissDirective } from './headless/notification-dismiss.directive';
import { NotificationSwipeToDismissDirective } from './headless/notification-swipe-to-dismiss.directive';
import { NotificationDirective } from './headless/notification.directive';
import { NotificationComponent } from './notification.component';

export const NOTIFICATION_IMPORTS = [
  NotificationComponent,
  NotificationDirective,
  NotificationActionDirective,
  NotificationDismissDirective,
  NotificationSwipeToDismissDirective,
] as const;
