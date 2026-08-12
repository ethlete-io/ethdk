import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { LiveResponseUpdateStorybookComponent } from './components/live-response-update-storybook.component';
import { queryDemoApiInterceptor } from './query-demo.utils';

export default {
  title: 'Query/Demos/Live Response Update',
  component: LiveResponseUpdateStorybookComponent,
  decorators: [
    applicationConfig({ providers: [provideHttpClient(withInterceptors([queryDemoApiInterceptor]))] }),
    moduleMetadata({ imports: [LiveResponseUpdateStorybookComponent] }),
  ],
} as Meta<LiveResponseUpdateStorybookComponent>;

type Story = StoryObj<LiveResponseUpdateStorybookComponent>;

export const Default: Story = {};
