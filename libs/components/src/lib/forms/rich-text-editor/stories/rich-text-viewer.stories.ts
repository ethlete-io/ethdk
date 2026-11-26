import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import {
  RichTextViewerBesideEditorStorybookComponent,
  RichTextViewerStorybookComponent,
} from './rich-text-viewer-storybook.component';

const SAMPLE =
  '# Match report\n\nA short intro with **bold**, *italic*, <u>underline</u>, ~~strikethrough~~ and `inline code`, written by {{field:firstName}} for {{field:club}}.\n\n## Highlights\n\n- First half\n  - Early goal\n- Second half\n\n1. Kick-off\n2. Final whistle\n\n> A quoted line from the coach.\n\n```\nconst goals = 3;\n```\n\n| Team | Goals |\n| :--- | ---: |\n| Home | 3 |\n| Away | 1 |\n\nRead more on [the club site](https://example.com).\n\nRaw HTML stays text: <script>alert(1)</script>';

export default {
  title: 'Components/Forms/Rich Text Viewer',
  component: RichTextViewerStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [RichTextViewerStorybookComponent, RichTextViewerBesideEditorStorybookComponent] }),
  ],
  argTypes: {
    value: { control: 'text' },
  },
  args: {
    value: SAMPLE,
  },
} as Meta<RichTextViewerStorybookComponent>;

type Story = StoryObj<RichTextViewerStorybookComponent>;

export const Default: Story = {};

export const BesideEditor: StoryObj<RichTextViewerBesideEditorStorybookComponent> = {
  render: (args) => ({
    props: args,
    template: `<et-sb-rich-text-viewer-beside-editor [value]="value" />`,
  }),
  args: {
    value: SAMPLE.replace(/\{\{field:(\w+)\}\}/g, '$1'),
  },
};
