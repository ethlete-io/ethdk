import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { BrandSpinnerStorybookComponent } from './components';

export default {
  title: 'Components/Loader/Brand Loader',
  component: BrandSpinnerStorybookComponent,
  decorators: [moduleMetadata({ imports: [BrandSpinnerStorybookComponent] })],
} as Meta<BrandSpinnerStorybookComponent>;

type Story = StoryObj<BrandSpinnerStorybookComponent>;

export const Default: Story = {};
