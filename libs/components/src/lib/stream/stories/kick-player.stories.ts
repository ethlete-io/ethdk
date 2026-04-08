import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import { KickPlayerSlotStorybookComponent, KickPlayerStorybookComponent } from './components';

export default {
  title: 'Components/Stream/Kick',
  component: KickPlayerStorybookComponent,
  argTypes: {
    channel: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    height: { control: { type: 'number' } },
  },
  args: {
    channel: 'asmongold247',
    width: '100%',
    height: 360,
  },
} as Meta<KickPlayerStorybookComponent>;

const Template: StoryFn<KickPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const LiveStream = {
  render: Template,
};

const SlotTemplate: StoryFn<KickPlayerSlotStorybookComponent> = (args) => ({
  props: args,
  template: `<et-sb-kick-player-slot [channel]="channel" />`,
});

export const SlotPictureInPicture = {
  render: SlotTemplate,
  decorators: [moduleMetadata({ imports: [KickPlayerSlotStorybookComponent] })],
  args: { channel: 'xqc' },
};
