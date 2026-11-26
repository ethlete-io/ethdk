import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { AlertDialogStorybookComponent } from './components';

export default {
  title: 'Components/Overlays/Alert Dialog',
  component: AlertDialogStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [AlertDialogStorybookComponent] }),
    applicationConfig({ providers: [provideOverlay()] }),
  ],
} as Meta<AlertDialogStorybookComponent>;

type Story = StoryObj<AlertDialogStorybookComponent>;

export const Default: Story = {};
