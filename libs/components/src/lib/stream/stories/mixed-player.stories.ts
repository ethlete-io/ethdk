import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';
import { MixedPlayerSlotStorybookComponent } from './components';

export default {
  title: 'Components/Stream/Mixed',
  component: MixedPlayerSlotStorybookComponent,
} as Meta<MixedPlayerSlotStorybookComponent>;

const SlotTemplate: StoryFn<MixedPlayerSlotStorybookComponent> = (args) => ({
  props: args,
  template: `
    <et-sb-mixed-player-slot
      [youtubeVideoId]="youtubeVideoId"
      [twitchChannel]="twitchChannel"
      [tiktokVideoIdA]="tiktokVideoIdA"
    />
  `,
});

export const MixedAspectRatios = {
  render: SlotTemplate,
  decorators: [moduleMetadata({ imports: [MixedPlayerSlotStorybookComponent] })],
  args: {
    youtubeVideoId: 'dQw4w9WgXcQ',
    twitchChannel: 'lofigirl',
    tiktokVideoIdA: '6718335390845095173',
  },
};
