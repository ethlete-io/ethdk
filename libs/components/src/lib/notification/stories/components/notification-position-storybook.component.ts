import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { provideNotificationManager } from '../../notification-manager';
import { NotificationStorybookComponent } from './notification-storybook.component';

const statusColorMapping = {
  info: 'brand',
  error: 'danger',
  success: 'brand',
  loading: 'brand',
};

@Component({
  selector: 'et-sb-notification-bottom-end',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'bottom-end',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationBottomEndStorybookComponent {}

@Component({
  selector: 'et-sb-notification-bottom-center',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'bottom-center',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationBottomCenterStorybookComponent {}

@Component({
  selector: 'et-sb-notification-bottom-start',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'bottom-start',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationBottomStartStorybookComponent {}

@Component({
  selector: 'et-sb-notification-top-end',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'top-end',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationTopEndStorybookComponent {}

@Component({
  selector: 'et-sb-notification-top-center',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'top-center',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationTopCenterStorybookComponent {}

@Component({
  selector: 'et-sb-notification-top-start',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [
    provideNotificationManager({
      position: 'top-start',
      statusColorMapping: statusColorMapping,
    }),
  ],
})
export class NotificationTopStartStorybookComponent {}
