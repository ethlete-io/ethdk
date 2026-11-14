import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { DropzoneStorybookComponent } from './dropzone-storybook.component';
import { mockUploadInterceptor } from './upload-mock';

export default {
  title: 'Components/Forms/Dropzone',
  component: DropzoneStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [DropzoneStorybookComponent] }),
    applicationConfig({
      providers: [provideHttpClient(withInterceptors([mockUploadInterceptor]))],
    }),
  ],
  argTypes: {
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    hint: { control: 'text' },
    accept: { control: 'text' },
    multiple: { control: 'boolean' },
    maxFileSize: { control: 'number' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    flaky: { table: { disable: true } },
    serverResponse: { table: { disable: true } },
    v2: { table: { disable: true } },
    initialValue: { table: { disable: true } },
    cropAspectRatio: { control: 'number' },
  },
  args: {
    color: 'brand',
    hint: '',
    accept: '',
    multiple: false,
    maxFileSize: null,
    disabled: false,
    readonly: false,
    required: false,
    flaky: false,
    serverResponse: false,
    v2: false,
    initialValue: null,
    cropAspectRatio: null,
  },
} as Meta<DropzoneStorybookComponent>;

type Story = StoryObj<DropzoneStorybookComponent>;

export const Default: Story = {};

export const Multiple: Story = {
  args: {
    multiple: true,
  },
};

export const ExistingMedia: Story = {
  args: {
    multiple: true,
    initialValue: ['mountain', 'ocean'],
  },
};

export const Readonly: Story = {
  args: {
    multiple: true,
    readonly: true,
    initialValue: ['mountain', 'ocean'],
  },
};

export const ReadonlySingle: Story = {
  args: {
    readonly: true,
    initialValue: 'mountain',
  },
};

export const FailingUploads: Story = {
  args: {
    flaky: true,
  },
};

export const LegacyV2Query: Story = {
  args: {
    multiple: true,
    hint: 'Uploads run through the legacy V2QueryClient adapter.',
    v2: true,
  },
};

export const Crop: Story = {
  args: {
    cropAspectRatio: 16 / 9,
    hint: 'Images open a 16:9 crop step before they upload, scaled to at most 512px wide.',
  },
};

export const ExistingFiles: Story = {
  args: {
    multiple: true,
    initialValue: ['mountain', 'contract.pdf'],
    hint: 'Name, size, upload date and thumbnail come from resolveExisting - no file is downloaded.',
  },
};

export const ServerResponse: Story = {
  args: {
    multiple: true,
    serverResponse: true,
    hint: 'The server response sets the thumbnail and upload date. Files named "fail…" are rejected by the server.',
  },
};
