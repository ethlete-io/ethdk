import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import { SoopPlayerSlotStorybookComponent, SoopPlayerStorybookComponent } from './components';

export default {
  title: 'Components/Stream/SOOP',
  component: SoopPlayerStorybookComponent,
  argTypes: {
    userId: { control: { type: 'text' } },
    videoId: { control: { type: 'text' } },
  },
  args: {
    userId: 'kbsnews',
    videoId: null,
  },
} as Meta<SoopPlayerStorybookComponent>;

const Template: StoryFn<SoopPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const LiveStream = {
  render: Template,
};

const SlotTemplate: StoryFn<SoopPlayerSlotStorybookComponent> = (args) => ({
  props: args,
  template: `<et-sb-soop-player-slot [userId]="userId" />`,
});

export const SlotPictureInPicture = {
  render: SlotTemplate,
  decorators: [moduleMetadata({ imports: [SoopPlayerSlotStorybookComponent] })],
  args: { userId: 'kbsnews' },
};
