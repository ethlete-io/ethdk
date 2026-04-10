import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { provideNotificationManager } from '../../notification-manager';
import { NotificationStorybookComponent } from './notification-storybook.component';

@Component({
  selector: 'et-sb-notification-bottom-end',
  template: `<et-sb-notification />`,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'bottom-end' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class NotificationBottomEndStorybookComponent {}

@Component({
  selector: 'et-sb-notification-bottom-center',
  template: `<et-sb-notification />`,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'bottom-center' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class NotificationBottomCenterStorybookComponent {}

@Component({
  selector: 'et-sb-notification-bottom-start',
  template: `<et-sb-notification />`,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'bottom-start' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class NotificationBottomStartStorybookComponent {}

@Component({
  selector: 'et-sb-notification-top-end',
  template: `<et-sb-notification />`,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'top-end' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class NotificationTopEndStorybookComponent {}

@Component({
  selector: 'et-sb-notification-top-center',
  template: `<et-sb-notification />`,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'top-center' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class NotificationTopCenterStorybookComponent {}

@Component({
  selector: 'et-sb-notification-top-start',
  template: `<et-sb-notification />`,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'top-start' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class NotificationTopStartStorybookComponent {}
