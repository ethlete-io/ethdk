import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { KbdStorybookComponent } from './kbd-storybook.component';

export default {
  title: 'Components/Data display/Kbd',
  component: KbdStorybookComponent,
  decorators: [moduleMetadata({ imports: [KbdStorybookComponent] })],
  args: { keys: 'mod+k', platform: undefined },
  argTypes: { platform: { control: 'inline-radio', options: [undefined, 'apple', 'other'] } },
} as Meta<KbdStorybookComponent>;

type Story = StoryObj<KbdStorybookComponent>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'With no `platform` set, the glyphs follow the platform this browser is running on.',
      },
    },
  },
};

export const Apple: Story = {
  args: { platform: 'apple' },
  parameters: {
    docs: {
      description: {
        story: 'Pinned to Apple, where `mod` is `⌘` and the other modifiers have glyphs of their own.',
      },
    },
  },
};

export const Other: Story = {
  args: { platform: 'other' },
  parameters: {
    docs: {
      description: {
        story: 'Pinned to everything else, where `mod` is `Ctrl` and the modifiers are spelled out.',
      },
    },
  },
};
