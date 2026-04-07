import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import { TwitchPlayerSlotStorybookComponent, TwitchPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/Twitch',
  component: TwitchPlayerStorybookComponent,
  argTypes: {
    src: {
      control: { type: 'text' },
      description: 'Channel name, channel URL, numeric VOD ID, or VOD URL.',
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
    src: 'monstercat',
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
    src: 'lofigirl',
  },
};

export const VOD = {
  render: Template,
  args: {
    src: 'https://www.twitch.tv/videos/2171815993',
  },
};

const SlotTemplate: StoryFn<TwitchPlayerSlotStorybookComponent> = (args) => ({
  props: args,
  template: `<et-sb-twitch-player-slot [src]="src" />`,
});

export const SlotPictureInPicture = {
  render: SlotTemplate,
  decorators: [moduleMetadata({ imports: [TwitchPlayerSlotStorybookComponent] })],
  args: { channel: 'lofigirl' },
};
