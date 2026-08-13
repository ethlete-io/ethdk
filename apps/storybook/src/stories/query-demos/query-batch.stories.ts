import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { QueryBatchStorybookComponent } from './components/query-batch-storybook.component';
import { queryDemoApiInterceptor } from './query-demo.utils';

export default {
  title: 'Query/Demos/Query Batch',
  component: QueryBatchStorybookComponent,
  decorators: [
    applicationConfig({ providers: [provideHttpClient(withInterceptors([queryDemoApiInterceptor]))] }),
    moduleMetadata({ imports: [QueryBatchStorybookComponent] }),
  ],
} as Meta<QueryBatchStorybookComponent>;

type Story = StoryObj<QueryBatchStorybookComponent>;

/**
 * `createQueryBatch` over 24 posts with `concurrency: 4`, driving a button's `[progress]`, a progress
 * bar and a remaining-time label from `remainingTime()` / `itemsPerSecond()`.
 */
export const Default: Story = {};
