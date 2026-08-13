import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormSubmissionStorybookComponent } from './submission-storybook.component';

export default {
  title: 'Components/Forms/Submission',
  component: FormSubmissionStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormSubmissionStorybookComponent] })],
} as Meta<FormSubmissionStorybookComponent>;

type Story = StoryObj<FormSubmissionStorybookComponent>;

/**
 * `[etForm]` submits the form through its own `submission.action`, so the template needs no submit
 * handler and no `$event.preventDefault()`. The button stays enabled while the form is invalid:
 * pressing it from the bottom of the form marks every field touched - which is what makes the errors
 * appear - and scrolls the first one back into view with focus on its control.
 */
export const Default: Story = {};
