import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MatchEditorStorybookComponent } from './match-editor-storybook.component';

export default {
  title: 'Components/Sports/Match editor',
  component: MatchEditorStorybookComponent,
  decorators: [moduleMetadata({ imports: [MatchEditorStorybookComponent] })],
} as Meta<MatchEditorStorybookComponent>;

type Story = StoryObj<MatchEditorStorybookComponent>;

export const Editor: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'An editor row from the parts: two `et-match-participant`s with an edit control in the slot, around an ' +
          '`et-match-scoreline`. The second block shows `etMatchParticipantEdit="beside"`, which keeps the name.',
      },
    },
  },
};
