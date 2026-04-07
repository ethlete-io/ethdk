import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import { VimeoPlayerSlotStorybookComponent, VimeoPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/Vimeo',
  component: VimeoPlayerStorybookComponent,
  argTypes: {
    videoId: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    height: { control: { type: 'number' } },
  },
  args: {
    videoId: 148751763,
    width: '100%',
    height: 360,
  },
} as Meta<VimeoPlayerStorybookComponent>;

const Template: StoryFn<VimeoPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};

const SlotTemplate: StoryFn<VimeoPlayerSlotStorybookComponent> = (args) => ({
  props: args,
  template: `<et-sb-vimeo-player-slot [videoId]="videoId" />`,
});

export const SlotPictureInPicture = {
  render: SlotTemplate,
  decorators: [moduleMetadata({ imports: [VimeoPlayerSlotStorybookComponent] })],
  args: { videoId: 148751763 },
};
