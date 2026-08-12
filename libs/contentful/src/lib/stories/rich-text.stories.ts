import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextStorybookComponent } from './rich-text-storybook.component';

export default {
  title: 'Contentful/Rich Text',
  component: RichTextStorybookComponent,
  decorators: [moduleMetadata({ imports: [RichTextStorybookComponent] })],
  args: { fixture: 'embeds' },
  argTypes: { fixture: { control: 'inline-radio', options: ['embeds', 'lists', 'tables'] } },
} as Meta<RichTextStorybookComponent>;

type Story = StoryObj<RichTextStorybookComponent>;

export const EmbeddedEntries: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`provideContentfulConfig({ customComponents })` maps a content type id to a component, which the renderer stamps for every `embedded-entry-block` and `embedded-entry-inline`. A component may declare any subset of `fields`, `sys`, `metadata` and `includes`.',
      },
    },
  },
};

export const Lists: Story = {
  args: { fixture: 'lists' },
  parameters: {
    docs: {
      description: {
        story: 'Ordered, unordered and nested lists, a blockquote and an `hr` - all plain HTML output, no components.',
      },
    },
  },
};

export const Tables: Story = {
  args: { fixture: 'tables' },
  parameters: {
    docs: {
      description: {
        story: 'A table with a header row. Every cell holds full rich text, so its content is a paragraph node.',
      },
    },
  },
};
