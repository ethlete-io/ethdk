import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import {
  RichTextEditorTokenDisplayStorybookComponent,
  RichTextEditorTokenPaletteStorybookComponent,
  RichTextEditorTriggersStorybookComponent,
} from './rich-text-editor-triggers-storybook.component';

export default {
  title: 'Components/Forms/Rich Text Editor/Triggers',
  component: RichTextEditorTriggersStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [
        RichTextEditorTriggersStorybookComponent,
        RichTextEditorTokenDisplayStorybookComponent,
        RichTextEditorTokenPaletteStorybookComponent,
      ],
    }),
  ],
} as Meta<RichTextEditorTriggersStorybookComponent>;

type Story = StoryObj<RichTextEditorTriggersStorybookComponent>;

/** `#` inserts a merge field (sync list); `@` mentions a teammate (async, debounced search). */
export const Default: Story = {};

/** A read-only editor rendering a stored value that contains `{{type:id}}` tokens as chips, using
 *  `provideRichTextEditorTokenRendering` - no interactive picker pulled in. */
export const TokenDisplay: StoryObj<RichTextEditorTokenDisplayStorybookComponent> = {
  render: () => ({ template: '<et-sb-rich-text-editor-token-display />' }),
};

/** A click-to-insert token palette (`et-rich-text-editor-token-palette`) beneath the editor. Clicking
 *  a chip inserts its `{{type:id}}` token at the caret - the same result as picking it from the `#`
 *  popup. */
export const TokenPalette: StoryObj<RichTextEditorTokenPaletteStorybookComponent> = {
  render: () => ({ template: '<et-sb-rich-text-editor-token-palette />' }),
};
