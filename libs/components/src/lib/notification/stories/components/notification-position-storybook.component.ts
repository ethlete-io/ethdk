import { Component, ViewEncapsulation, input } from '@angular/core';
import { provideNotificationManager } from '../../notification-manager';
import { NotificationStorybookComponent } from './notification-storybook.component';

const statusColorMapping = {
  info: 'brand',
  error: 'danger',
  success: 'brand',
  loading: 'brand',
};

/** Each wrapper only exists to provide a stack position; `direction` is forwarded so the RTL stories
 * can flip the document root and show the `start`/`end` positions swapping edges. */
@Component({
  selector: 'et-sb-notification-bottom-end',
  template: `<et-sb-notification [direction]="direction()" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'bottom-end',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationBottomEndStorybookComponent {
  public direction = input<'' | 'rtl'>('');
}

@Component({
  selector: 'et-sb-notification-bottom-center',
  template: `<et-sb-notification [direction]="direction()" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'bottom-center',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationBottomCenterStorybookComponent {
  public direction = input<'' | 'rtl'>('');
}

@Component({
  selector: 'et-sb-notification-bottom-start',
  template: `<et-sb-notification [direction]="direction()" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'bottom-start',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationBottomStartStorybookComponent {
  public direction = input<'' | 'rtl'>('');
}

@Component({
  selector: 'et-sb-notification-top-end',
  template: `<et-sb-notification [direction]="direction()" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'top-end',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationTopEndStorybookComponent {
  public direction = input<'' | 'rtl'>('');
}

@Component({
  selector: 'et-sb-notification-top-center',
  template: `<et-sb-notification [direction]="direction()" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'top-center',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationTopCenterStorybookComponent {
  public direction = input<'' | 'rtl'>('');
}

@Component({
  selector: 'et-sb-notification-top-start',
  template: `<et-sb-notification [direction]="direction()" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'top-start',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationTopStartStorybookComponent {
  public direction = input<'' | 'rtl'>('');
}
