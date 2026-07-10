import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MenuContextStorybookComponent, MenuStorybookComponent } from './components';

export default {
  title: 'Components/Menu',
  component: MenuStorybookComponent,
  decorators: [moduleMetadata({ imports: [MenuStorybookComponent, MenuContextStorybookComponent] })],
  args: {
    placement: 'auto',
    hoverOpen: true,
    disabled: false,
    arrow: true,
  },
  argTypes: {
    placement: {
      control: 'radio',
      options: ['auto', 'bottom-start', 'bottom-end', 'top-start', 'top-end', 'right-start', 'left-start'],
    },
    hoverOpen: { control: 'boolean' },
    disabled: { control: 'boolean' },
    arrow: { control: 'boolean' },
  },
} as Meta<MenuStorybookComponent>;

type Story = StoryObj<MenuStorybookComponent>;

export const Default: Story = {};

export const WithoutHoverOpen: Story = {
  args: {
    hoverOpen: false,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const ContextMenu: Story = {
  render: () => ({
    template: `<et-sb-menu-context />`,
  }),
};
