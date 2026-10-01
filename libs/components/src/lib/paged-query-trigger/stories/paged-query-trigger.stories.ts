import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { mockPagedQueryInterceptor, PagedQueryTriggerStorybookComponent } from './components';

/**
 * `etPagedQueryTrigger` fetches the next page of a paged query stack when it scrolls into view. Inside
 * an `et-scrollable` it observes the track, so `rootMargin` pre-fetches before the rail end is reached.
 */
export default {
  title: 'Components/Data display/Paged query trigger',
  component: PagedQueryTriggerStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [PagedQueryTriggerStorybookComponent] }),
    applicationConfig({
      providers: [provideHttpClient(withInterceptors([mockPagedQueryInterceptor]))],
    }),
  ],
  argTypes: {
    rootMargin: { control: 'text' },
    delay: { control: { type: 'number', min: 0, step: 100 } },
  },
  args: {
    rootMargin: '200px',
    delay: 600,
  },
} as Meta<PagedQueryTriggerStorybookComponent>;

type Story = StoryObj<PagedQueryTriggerStorybookComponent>;

export const Default: Story = {};
