import { ProvideColorDirective } from '@ethlete/core';
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { CommandPaletteStorybookComponent } from './command-palette-storybook.component';

export default {
  title: 'Components/Overlays/Command palette',
  component: CommandPaletteStorybookComponent,
  decorators: [moduleMetadata({ imports: [CommandPaletteStorybookComponent] })],
} as Meta<CommandPaletteStorybookComponent>;

type Story = StoryObj<CommandPaletteStorybookComponent>;

export const Default: Story = {};

export const ColorContext: Story = {
  decorators: [moduleMetadata({ imports: [ProvideColorDirective] })],
  render: () => ({
    template: `<div etProvideColor="danger"><et-sb-command-palette /></div>`,
  }),
};
