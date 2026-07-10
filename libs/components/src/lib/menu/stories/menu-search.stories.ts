import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MenuSearchAsyncStorybookComponent, MenuSearchStorybookComponent } from './components';

export default {
  title: 'Components/Menu/With Search',
  component: MenuSearchStorybookComponent,
  decorators: [moduleMetadata({ imports: [MenuSearchStorybookComponent, MenuSearchAsyncStorybookComponent] })],
} as Meta<MenuSearchStorybookComponent>;

type Story = StoryObj<MenuSearchStorybookComponent>;

export const Default: Story = {};

export const Async: Story = {
  render: () => ({
    template: `<et-sb-menu-search-async />`,
  }),
};
