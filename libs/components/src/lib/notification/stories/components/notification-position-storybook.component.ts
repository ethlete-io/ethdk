import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { provideNotificationManager } from '../../notification-manager';
import { NotificationStorybookComponent } from './notification-storybook.component';

@Component({
  selector: 'et-sb-notification-bottom-end',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'bottom-end' })],
})
export class NotificationBottomEndStorybookComponent {}

@Component({
  selector: 'et-sb-notification-bottom-center',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'bottom-center' })],
})
export class NotificationBottomCenterStorybookComponent {}

@Component({
  selector: 'et-sb-notification-bottom-start',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'bottom-start' })],
})
export class NotificationBottomStartStorybookComponent {}

@Component({
  selector: 'et-sb-notification-top-end',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'top-end' })],
})
export class NotificationTopEndStorybookComponent {}

@Component({
  selector: 'et-sb-notification-top-center',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'top-center' })],
})
export class NotificationTopCenterStorybookComponent {}

@Component({
  selector: 'et-sb-notification-top-start',
  template: `<et-sb-notification />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationStorybookComponent],
  providers: [provideNotificationManager({ position: 'top-start' })],
})
export class NotificationTopStartStorybookComponent {}
