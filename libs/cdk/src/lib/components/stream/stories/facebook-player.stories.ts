import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import { FacebookPlayerSlotStorybookComponent, FacebookPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/Facebook',
  component: FacebookPlayerStorybookComponent,
  argTypes: {
    videoId: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    height: { control: { type: 'number' } },
  },
  args: {
    videoId: '10155364627206729',
    width: '100%',
    height: 360,
  },
} as Meta<FacebookPlayerStorybookComponent>;

const Template: StoryFn<FacebookPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};

const SlotTemplate: StoryFn<FacebookPlayerSlotStorybookComponent> = (args) => ({
  props: args,
  template: `<et-sb-facebook-player-slot [videoId]="videoId" />`,
});

export const SlotPictureInPicture = {
  render: SlotTemplate,
  decorators: [moduleMetadata({ imports: [FacebookPlayerSlotStorybookComponent] })],
  args: { videoId: '10155364627206729' },
};
