import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { OverlayRuntimePopoverStorybookComponent, OverlayRuntimeStorybookComponent } from './components';

export default {
  title: 'Core/Overlay/Runtime',
  component: OverlayRuntimeStorybookComponent,
  decorators: [moduleMetadata({ imports: [OverlayRuntimePopoverStorybookComponent] })],
} as Meta<OverlayRuntimeStorybookComponent>;

export const Modal: StoryObj<OverlayRuntimeStorybookComponent> = {};

export const Popover: StoryObj<OverlayRuntimePopoverStorybookComponent> = {
  render: (args) => ({
    props: args,
    template: `<et-sb-overlay-runtime-popover [viewportPadding]="viewportPadding" />`,
  }),
  args: { viewportPadding: 24 },
  argTypes: { viewportPadding: { control: 'number' } },
};
