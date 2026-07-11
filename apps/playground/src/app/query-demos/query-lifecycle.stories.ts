import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { QueryLifecycleStorybookComponent } from './components/query-lifecycle-storybook.component';
import { queryDemoApiInterceptor } from './query-demo.utils';

export default {
  title: 'Query/Demos/Lifecycle',
  component: QueryLifecycleStorybookComponent,
  decorators: [
    applicationConfig({ providers: [provideHttpClient(withInterceptors([queryDemoApiInterceptor]))] }),
    moduleMetadata({ imports: [QueryLifecycleStorybookComponent] }),
  ],
} as Meta<QueryLifecycleStorybookComponent>;

type Story = StoryObj<QueryLifecycleStorybookComponent>;

export const Default: Story = {};
