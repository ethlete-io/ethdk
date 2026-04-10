import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import {
  NotificationBottomCenterStorybookComponent,
  NotificationBottomEndStorybookComponent,
  NotificationBottomStartStorybookComponent,
  NotificationStorybookComponent,
  NotificationTopCenterStorybookComponent,
  NotificationTopEndStorybookComponent,
  NotificationTopStartStorybookComponent,
} from './components';

export default {
  title: 'Components/Notification',
  component: NotificationStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [NotificationBottomEndStorybookComponent],
    }),
  ],
} as Meta<NotificationStorybookComponent>;

export const BottomEnd: { render: StoryFn } = {
  render: () => ({ template: `<et-sb-notification-bottom-end />` }),
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
