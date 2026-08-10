import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { provideQueryDevtools } from '@ethlete/query';
import { QueryDevtoolsStorybookComponent } from './components/query-devtools-storybook.component';
import { queryDevtoolsDemoInterceptor } from './query-devtools-demo.utils';

export default {
  title: 'Components/Query Devtools',
  component: QueryDevtoolsStorybookComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideHttpClient(withInterceptors([queryDevtoolsDemoInterceptor])),
        // The query-form card syncs its fields to the URL, which needs a router.
        provideRouter([{ path: '**', children: [] }], withHashLocation()),
        provideQueryDevtools({
          about: { version: '1.4.2', sha: 'a3f9c1e', environment: 'storybook' },
        }),
      ],
    }),
    moduleMetadata({ imports: [QueryDevtoolsStorybookComponent] }),
  ],
} as Meta<QueryDevtoolsStorybookComponent>;

type Story = StoryObj<QueryDevtoolsStorybookComponent>;

export const Default: Story = {};
