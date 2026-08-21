import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { provideQueryDevtools } from '@ethlete/query';
import { QueryDevtoolsStorybookComponent } from './components/query-devtools-storybook.component';
import { QUERY_DEVTOOLS_DEMO_SCHEMA, queryDevtoolsDemoInterceptor } from './query-devtools-demo.utils';

export default {
  title: 'Components/Dev tools/Query Devtools',
  component: QueryDevtoolsStorybookComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideHttpClient(withInterceptors([queryDevtoolsDemoInterceptor])),
        // The query-form card syncs its fields to the URL, which needs a router.
        provideRouter([{ path: '**', children: [] }], withHashLocation()),
        provideQueryDevtools({
          about: { version: '1.4.2', sha: 'a3f9c1e', environment: 'storybook' },
          schema: () => QUERY_DEVTOOLS_DEMO_SCHEMA,
          apiEnvs: [
            {
              name: 'Demo API',
              storageKey: 'etQueryDevtoolsDemoApiEnv',
              fallback: 'staging',
              custom: true,
              envs: [
                { id: 'local', url: 'http://localhost:3000' },
                { id: 'staging', url: 'https://api.staging.example.com' },
                { id: 'production', url: 'https://api.example.com', production: true },
              ],
            },
          ],
        }),
      ],
    }),
    moduleMetadata({ imports: [QueryDevtoolsStorybookComponent] }),
  ],
} as Meta<QueryDevtoolsStorybookComponent>;

type Story = StoryObj<QueryDevtoolsStorybookComponent>;

export const Default: Story = {};

/** The same panel behind `<et-query-devtools-lazy>`: only the toggle exists until it is first opened. */
export const Lazy: Story = { args: { lazy: true } };
