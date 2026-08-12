import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Meta, StoryFn, applicationConfig, moduleMetadata } from '@storybook/angular';
import { CLOCK_ICON, provideIconOverrides } from '../../icon';
import {
  NotificationBottomCenterStorybookComponent,
  NotificationBottomEndStorybookComponent,
  NotificationBottomStartStorybookComponent,
  NotificationPromiseStorybookComponent,
  NotificationStorybookComponent,
  NotificationTopCenterStorybookComponent,
  NotificationTopEndStorybookComponent,
  NotificationTopStartStorybookComponent,
  notificationPromiseDemoInterceptor,
} from './components';

export default {
  title: 'Components/Feedback/Notification',
  component: NotificationStorybookComponent,
  decorators: [
    // The stack renders from the manager's own (root) injector, so a per-notification `icon` name has
    // to be registered app-wide - which is what `provideIconOverrides` is for.
    applicationConfig({
      providers: [
        provideIconOverrides(CLOCK_ICON),
        provideHttpClient(withInterceptors([notificationPromiseDemoInterceptor])),
      ],
    }),
    moduleMetadata({
      imports: [NotificationBottomEndStorybookComponent],
    }),
  ],
} as Meta<NotificationStorybookComponent>;

export const BottomEnd: { render: StoryFn } = {
  render: () => ({ template: `<et-sb-notification-bottom-end />` }),
};

/** `manager.promise()` following a promise, an observable and an `@ethlete/query` query. */
export const PromiseApi: { render: StoryFn; decorators: unknown[] } = {
  render: () => ({ template: `<et-sb-notification-promise />` }),
  decorators: [moduleMetadata({ imports: [NotificationPromiseStorybookComponent] })],
};

export const BottomCenter: { render: StoryFn; decorators: unknown[] } = {
  render: () => ({ template: `<et-sb-notification-bottom-center />` }),
  decorators: [moduleMetadata({ imports: [NotificationBottomCenterStorybookComponent] })],
};

export const BottomStart: { render: StoryFn; decorators: unknown[] } = {
  render: () => ({ template: `<et-sb-notification-bottom-start />` }),
  decorators: [moduleMetadata({ imports: [NotificationBottomStartStorybookComponent] })],
};

export const TopEnd: { render: StoryFn; decorators: unknown[] } = {
  render: () => ({ template: `<et-sb-notification-top-end />` }),
  decorators: [moduleMetadata({ imports: [NotificationTopEndStorybookComponent] })],
};

export const TopCenter: { render: StoryFn; decorators: unknown[] } = {
  render: () => ({ template: `<et-sb-notification-top-center />` }),
  decorators: [moduleMetadata({ imports: [NotificationTopCenterStorybookComponent] })],
};

export const TopStart: { render: StoryFn; decorators: unknown[] } = {
  render: () => ({ template: `<et-sb-notification-top-start />` }),
  decorators: [moduleMetadata({ imports: [NotificationTopStartStorybookComponent] })],
};

/** `bottom-end` under `dir="rtl"` - the stack docks to the physical left and slides in from there. */
export const BottomEndRightToLeft: { render: StoryFn } = {
  render: () => ({ template: `<et-sb-notification-bottom-end direction="rtl" />` }),
};

/** The mirror image: `bottom-start` in RTL docks to the physical right. */
export const BottomStartRightToLeft: { render: StoryFn; decorators: unknown[] } = {
  render: () => ({ template: `<et-sb-notification-bottom-start direction="rtl" />` }),
  decorators: [moduleMetadata({ imports: [NotificationBottomStartStorybookComponent] })],
};
