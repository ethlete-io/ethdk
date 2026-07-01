import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldRichTextEditorStorybookComponent } from './rich-text-editor-storybook.component';

export default {
  title: 'Components/Forms/Rich Text Editor',
  component: FormFieldRichTextEditorStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldRichTextEditorStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    labelMode: { control: 'select', options: ['static', 'inline'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    appearance: 'box',
    fill: 'transparent',
    size: 'md',
    labelMode: 'static',
    label: 'Description',
    placeholder: 'Write something…',
    hint: '',
    value: '',
    disabled: false,
    required: false,
    color: 'brand',
  },
} as Meta<FormFieldRichTextEditorStorybookComponent>;

type Story = StoryObj<FormFieldRichTextEditorStorybookComponent>;

export const Default: Story = {};

export const WithMarkdown: Story = {
  args: {
    value: 'A short intro with **bold**, *italic* and ~~strikethrough~~.\n\n- First item\n- Second item\n\nA [link](https://example.com) too.',
  },
};
