import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import { DailymotionPlayerSlotStorybookComponent, DailymotionPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/Dailymotion',
  component: DailymotionPlayerStorybookComponent,
  argTypes: {
    videoId: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    height: { control: { type: 'number' } },
  },
  args: {
    videoId: 'x84sh87',
    width: '100%',
    height: 360,
  },
} as Meta<DailymotionPlayerStorybookComponent>;

const Template: StoryFn<DailymotionPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};

const SlotTemplate: StoryFn<DailymotionPlayerSlotStorybookComponent> = (args) => ({
  props: args,
  template: `<et-sb-dailymotion-player-slot [videoId]="videoId" />`,
});

export const SlotPictureInPicture = {
  render: SlotTemplate,
  decorators: [moduleMetadata({ imports: [DailymotionPlayerSlotStorybookComponent] })],
  args: { videoId: 'x84sh87' },
};
