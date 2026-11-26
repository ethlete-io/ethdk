import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { PagedQueryStorybookComponent } from './components/paged-query-storybook.component';
import { queryDemoApiInterceptor } from './query-demo.utils';

export default {
  title: 'Query/Demos/Paged Query',
  component: PagedQueryStorybookComponent,
  decorators: [
    applicationConfig({ providers: [provideHttpClient(withInterceptors([queryDemoApiInterceptor]))] }),
    moduleMetadata({ imports: [PagedQueryStorybookComponent] }),
  ],
} as Meta<PagedQueryStorybookComponent>;

type Story = StoryObj<PagedQueryStorybookComponent>;

export const Default: Story = {};
