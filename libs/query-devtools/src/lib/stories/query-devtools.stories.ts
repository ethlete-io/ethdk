import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, AngularRenderer, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { DecoratorFunction } from 'storybook/internal/types';
import { provideQueryDevtools } from '@ethlete/query';
import { QueryDevtoolsStorybookComponent } from './components/query-devtools-storybook.component';
import { QUERY_DEVTOOLS_DEMO_SCHEMA, queryDevtoolsDemoInterceptor } from './query-devtools-demo.utils';

const provideDemoDevtools = (showInAutomation: boolean) =>
  provideQueryDevtools({
    showInAutomation,
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
    authAccounts: [
      {
        provider: 'devtools-demo',
        label: 'Admin',
        loginQuery: 'login',
        note: 'every permission',
        fields: [
          { name: 'username', default: 'admin' },
          { name: 'password', type: 'password' },
        ],
      },
      {
        provider: 'devtools-demo',
        label: 'Reader',
        loginQuery: 'login',
        note: 'read only',
        fields: [
          { name: 'username', default: 'reader' },
          { name: 'password', type: 'password' },
        ],
      },
    ],
  });

// provideQueryDevtools reads its options on the first call, so it must run per rendered story, not at module load.
const withDemoDevtools =
  (showInAutomation: boolean): DecoratorFunction<AngularRenderer> =>
  (story, context) =>
    applicationConfig({ providers: [provideDemoDevtools(showInAutomation)] })(story, context);

export default {
  title: 'Components/Dev tools/Query Devtools',
  component: QueryDevtoolsStorybookComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideHttpClient(withInterceptors([queryDevtoolsDemoInterceptor])),
        // The query-form card syncs its fields to the URL, which needs a router.
        provideRouter([{ path: '**', children: [] }], withHashLocation()),
      ],
    }),
    moduleMetadata({ imports: [QueryDevtoolsStorybookComponent] }),
  ],
} as Meta<QueryDevtoolsStorybookComponent>;

type Story = StoryObj<QueryDevtoolsStorybookComponent>;

export const Default: Story = { decorators: [withDemoDevtools(true)] };

/** The same panel behind `<et-query-devtools-lazy>`: only the toggle exists until it is first opened. */
export const Lazy: Story = {
  args: { lazy: true },
  decorators: [withDemoDevtools(true)],
};

/** Without `showInAutomation`, so the devtools UI hides itself under Playwright. */
export const Automation: Story = { decorators: [withDemoDevtools(false)] };
