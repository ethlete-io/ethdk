import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { provideQueryDevtools } from '@ethlete/query';
import { QueryDevtoolsStorybookComponent } from './components/query-devtools-storybook.component';
import { queryDevtoolsDemoInterceptor } from './query-devtools-demo.utils';

export default {
  title: 'Components/Query Devtools',
  component: QueryDevtoolsStorybookComponent,
  decorators: [
    applicationConfig({
      providers: [provideHttpClient(withInterceptors([queryDevtoolsDemoInterceptor])), provideQueryDevtools()],
    }),
    moduleMetadata({ imports: [QueryDevtoolsStorybookComponent] }),
  ],
} as Meta<QueryDevtoolsStorybookComponent>;

type Story = StoryObj<QueryDevtoolsStorybookComponent>;

export const Default: Story = {};
