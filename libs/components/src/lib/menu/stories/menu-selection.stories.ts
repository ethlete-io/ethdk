import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MenuSelectionStorybookComponent } from './components';

export default {
  title: 'Components/Menu/With Selection',
  component: MenuSelectionStorybookComponent,
  decorators: [moduleMetadata({ imports: [MenuSelectionStorybookComponent] })],
} as Meta<MenuSelectionStorybookComponent>;

type Story = StoryObj<MenuSelectionStorybookComponent>;

export const Default: Story = {};
