import { provideRouter, withHashLocation } from '@angular/router';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { FilterOverlayStorybookComponent } from './filter-overlay-storybook.component';

export default {
  title: 'Components/Filter overlay',
  component: FilterOverlayStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [FilterOverlayStorybookComponent] }),
    // The query form writes its committed value to the URL, so it needs a router. Hash location keeps the
    // rewriting inside the story iframe.
    applicationConfig({ providers: [provideRouter([{ path: '**', children: [] }], withHashLocation())] }),
  ],
  args: { surface: 'dark', withPreview: true },
  argTypes: { surface: { control: 'text' }, withPreview: { control: 'boolean' } },
} as Meta<FilterOverlayStorybookComponent>;

type Story = StoryObj<FilterOverlayStorybookComponent>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The whole pattern: a floating **Filters** trigger with an active-filter badge, opening a routed panel ' +
          'whose pages edit a *draft* of the page query form. The submit button reports how many teams the draft ' +
          'would show and disables itself at zero. Dismiss with Escape and nothing is applied; press submit and the ' +
          'filters - and the URL - update. Note the badge ignores the search box: the query form counts filters, ' +
          'and search is navigation state.',
      },
    },
  },
};

export const WithoutPreview: Story = {
  args: { withPreview: false },
  parameters: {
    docs: {
      description: {
        story:
          'No preview configured, so there is no count to wait for and the button simply reads "Show results", ' +
          'enabled. cdk returned its loading state here, which left the button permanently disabled.',
      },
    },
  },
};
