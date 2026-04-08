import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import { TikTokPlayerSlotStorybookComponent, TikTokPlayerStorybookComponent } from './components';

export default {
  title: 'Components/Stream/TikTok',
  component: TikTokPlayerStorybookComponent,
  argTypes: {
    videoId: { control: { type: 'text' } },
  },
  args: {
    videoId: '6718335390845095173',
  },
} as Meta<TikTokPlayerStorybookComponent>;

const Template: StoryFn<TikTokPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};

const SlotTemplate: StoryFn<TikTokPlayerSlotStorybookComponent> = (args) => ({
  props: args,
  template: `<et-sb-tiktok-player-slot [videoId]="videoId" />`,
});

export const SlotPictureInPicture = {
  render: SlotTemplate,
  decorators: [moduleMetadata({ imports: [TikTokPlayerSlotStorybookComponent] })],
  args: { videoId: '6718335390845095173' },
};
