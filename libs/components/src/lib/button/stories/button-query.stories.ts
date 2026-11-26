import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { mockUploadInterceptor } from '../../forms/dropzone/stories/upload-mock';
import { QueryButtonStorybookComponent } from './components';

/**
 * `etQueryButton` puts the button into its loading state while the bound query runs. The click
 * handler runs the query; the directive only observes it. This query reports upload progress, so the
 * spinner turns determinate.
 */
export default {
  title: 'Components/Actions/Button/Query',
  component: QueryButtonStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [QueryButtonStorybookComponent] }),
    applicationConfig({
      providers: [provideHttpClient(withInterceptors([mockUploadInterceptor]))],
    }),
  ],
  argTypes: {
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    showProgress: { control: 'boolean' },
  },
  args: {
    color: 'brand',
    showProgress: true,
  },
} as Meta<QueryButtonStorybookComponent>;

type Story = StoryObj<QueryButtonStorybookComponent>;

export const Default: Story = {};

/** `showProgress="false"` keeps the spinner indeterminate even though the query reports progress. */
export const WithoutProgress: Story = {
  args: { showProgress: false },
};
