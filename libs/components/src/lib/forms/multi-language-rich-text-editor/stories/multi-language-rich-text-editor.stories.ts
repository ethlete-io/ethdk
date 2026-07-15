import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldMultiLanguageRichTextEditorStorybookComponent } from './multi-language-rich-text-editor-storybook.component';

export default {
  title: 'Components/Forms/Multi Language Rich Text Editor',
  component: FormFieldMultiLanguageRichTextEditorStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldMultiLanguageRichTextEditorStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    labelMode: { control: 'select', options: ['static', 'inline'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
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
    disabled: false,
    readonly: false,
    color: 'brand',
  },
} as Meta<FormFieldMultiLanguageRichTextEditorStorybookComponent>;

type Story = StoryObj<FormFieldMultiLanguageRichTextEditorStorybookComponent>;

export const Default: Story = {};

export const WithExistingTranslations: Story = {
  args: {
    value: {
      en: '# Welcome\n\nAn intro in **English**.',
      de: '# Willkommen\n\nEine Einführung auf **Deutsch**.',
    },
  },
};

export const RequiredLanguages: Story = {
  args: {
    hint: 'English and German are required.',
    requireLanguages: ['en', 'de'],
    value: {
      en: '# Welcome\n\nAlready written.',
    },
  },
};
