import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { CommandPaletteStorybookComponent } from './command-palette-storybook.component';

export default {
  title: 'Components/Overlays/Command palette',
  component: CommandPaletteStorybookComponent,
  decorators: [moduleMetadata({ imports: [CommandPaletteStorybookComponent] })],
} as Meta<CommandPaletteStorybookComponent>;

type Story = StoryObj<CommandPaletteStorybookComponent>;

export const Default: Story = {};
