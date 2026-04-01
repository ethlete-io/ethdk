import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import {
  YoutubePlayerSlotConsentStorybookComponent,
  YoutubePlayerSlotStorybookComponent,
  YoutubePlayerStorybookComponent,
} from './components';

export default {
  title: 'CDK/Stream/YouTube',
  component: YoutubePlayerStorybookComponent,
  argTypes: {
    videoId: {
      control: { type: 'text' },
    },
    width: {
      control: { type: 'text' },
    },
    height: {
      control: { type: 'number' },
    },
  },
  args: {
    videoId: 'dQw4w9WgXcQ',
    width: '100%',
    height: 360,
  },
} as Meta<YoutubePlayerStorybookComponent>;

const Template: StoryFn<YoutubePlayerStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};

export const LiveStream = {
  render: Template,
  args: {
    videoId: 'jfKfPfyJRdk',
    width: '100%',
    height: 360,
  },
};

const SlotTemplate: StoryFn<YoutubePlayerSlotStorybookComponent> = (args) => ({
  props: args,
  template: `<et-sb-youtube-player-slot [videoId]="videoId" />`,
});

export const SlotPictureInPicture = {
  render: SlotTemplate,
  decorators: [
    moduleMetadata({
      imports: [YoutubePlayerSlotStorybookComponent],
    }),
  ],
  args: {
    videoId: 'dQw4w9WgXcQ',
  },
};

const SlotConsentTemplate: StoryFn<YoutubePlayerSlotConsentStorybookComponent> = (args) => ({
  props: args,
  template: `<et-sb-youtube-player-slot-consent [videoId]="videoId" />`,
});

export const SlotWithConsent = {
  render: SlotConsentTemplate,
  decorators: [
    moduleMetadata({
      imports: [YoutubePlayerSlotConsentStorybookComponent],
    }),
  ],
  args: {
    videoId: 'dQw4w9WgXcQ',
  },
};
