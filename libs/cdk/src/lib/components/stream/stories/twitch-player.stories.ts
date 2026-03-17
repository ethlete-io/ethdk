import { Meta, StoryFn } from '@storybook/angular';
import { TwitchPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/Twitch',
  component: TwitchPlayerStorybookComponent,
  argTypes: {
    channel: {
      control: { type: 'text' },
      description: 'Live channel name. Use either channel (live) or video (VOD).',
    },
    video: {
      control: { type: 'text' },
      description: 'VOD video ID. Use either channel (live) or video (VOD).',
    },
    width: {
      control: { type: 'text' },
    },
    height: {
      control: { type: 'number' },
    },
    autoplay: {
      control: { type: 'boolean' },
    },
  },
  args: {
    channel: 'monstercat',
    video: null,
    width: '100%',
    height: 360,
    autoplay: false,
  },
} as Meta<TwitchPlayerStorybookComponent>;

const Template: StoryFn<TwitchPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const LiveChannel = {
  render: Template,
  args: {
    channel: 'lofigirl',
    video: null,
  },
};

export const VOD = {
  render: Template,
  args: {
    channel: null,
    video: '2171815993',
  },
};
