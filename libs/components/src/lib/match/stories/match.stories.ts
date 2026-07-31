import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MatchCardStatesStorybookComponent, MatchCardStorybookComponent } from './match-card-storybook.component';

export default {
  title: 'Components/Match',
  component: MatchCardStorybookComponent,
  decorators: [moduleMetadata({ imports: [MatchCardStorybookComponent, MatchCardStatesStorybookComponent] })],
  args: {
    surface: 'dark',
    width: 360,
    size: 'auto',
    status: 'finished',
    resultKind: 'score',
    series: false,
    tbd: false,
    longNames: false,
    showSeeds: false,
    hideNames: false,
    animateScoreChanges: true,
    interactive: true,
    rtl: false,
  },
  argTypes: {
    surface: { control: 'text' },
    width: { control: { type: 'range', min: 180, max: 640, step: 10 } },
    size: { control: 'radio', options: ['auto', 'compact', 'expanded', 'wide'] },
    status: { control: 'radio', options: ['scheduled', 'live', 'finished'] },
    resultKind: { control: 'radio', options: ['score', 'points', 'outcome'] },
    series: { control: 'boolean' },
    tbd: { control: 'boolean' },
    longNames: { control: 'boolean' },
    showSeeds: { control: 'boolean' },
    hideNames: { control: 'boolean' },
    animateScoreChanges: { control: 'boolean' },
    interactive: { control: 'boolean' },
    rtl: { control: 'boolean' },
  },
} as Meta<MatchCardStorybookComponent>;

type Story = StoryObj<MatchCardStorybookComponent>;

export const Default: Story = {};

export const Compact: Story = {
  args: { width: 220 },
  parameters: {
    docs: {
      description: {
        story:
          'Narrow enough for the container query to land on the dense row — the shape a bracket column or a ' +
          'results list wants. `size="compact"` fixes it there regardless of width, and is the only setting that ' +
          "also swaps participant names for their short codes (a text change can't come out of a container query).",
      },
    },
  },
};

export const HiddenNames: Story = {
  args: { width: 200, hideNames: true, resultKind: 'outcome' },
  parameters: {
    docs: {
      description: {
        story:
          'The densest cell there is: emblems and results, nothing else. `hideNames` drops the names from the ' +
          "drawing only — they stay in the card's accessible name and in each emblem's alt text.",
      },
    },
  },
};

export const Expanded: Story = {
  args: { width: 460, series: true },
  parameters: {
    docs: {
      description: {
        story:
          'Past 320px the same card becomes the featured one: bigger emblems, bigger score, and the per-game ' +
          'breakdown of a series, which the dense row hides.',
      },
    },
  },
};

export const Live: Story = {
  args: { status: 'live' },
  parameters: {
    docs: {
      description: {
        story:
          'A running match shows a live badge instead of its kick-off, in the app\'s `type: "error"` color theme. ' +
          'Score the goals with the buttons: the value rolls, the side flashes, `scoreChange` fires with the side ' +
          'and delta, and a polite live region reads the new score once. Only while live — a finished result ' +
          'arriving with the page is not a moment. Turn `animateScoreChanges` off to keep the announcement without ' +
          'the movement.',
      },
    },
  },
};

export const Scheduled: Story = {
  args: { status: 'scheduled' },
  parameters: {
    docs: {
      description: {
        story: 'No score yet, so the kick-off carries the card — formatted in the active `DATE_LOCALE`.',
      },
    },
  },
};

export const Wide: Story = {
  args: { width: 620 },
  parameters: {
    docs: {
      description: {
        story:
          'From 560px the two sides stop stacking and face each other across the middle, results meeting in it — ' +
          'the shape a full-width fixture list wants. Same DOM as the other two layouts: the away side is mirrored ' +
          'in CSS, which is also why it keeps working in RTL.',
      },
    },
  },
};

export const Outcome: Story = {
  args: { resultKind: 'outcome' },
  parameters: {
    docs: {
      description: {
        story:
          'A competition that reports wins and losses rather than scores. The letters are derived from ' +
          '`winnerSide`, not sent as data, so nothing has to denormalize a result into a "W" — and a screen ' +
          'reader hears "FC Berlin won" rather than the letter. Never alongside a score: one slot, one form.',
      },
    },
  },
};

export const Points: Story = {
  args: { resultKind: 'points' },
  parameters: {
    docs: {
      description: {
        story:
          '`resultKind` picks which of the three forms a match reports. Points are drawn like a score and ' +
          'announced as what they are: "3 : 0 points".',
      },
    },
  },
};

export const LongNames: Story = {
  args: { longNames: true, width: 260 },
  parameters: {
    docs: {
      description: {
        story:
          'Names ellipsize rather than wrapping or pushing the score out of the card; the emblem frame and the ' +
          'score column keep their width.',
      },
    },
  },
};

export const Tbd: Story = {
  args: { tbd: true, status: 'scheduled' },
  parameters: {
    docs: {
      description: {
        story:
          'A `null` participant is a TBD slot, not an error — a bracket match whose feeder has not finished. The ' +
          'row keeps its height, and the composed name says "TBD" so the card still announces something.',
      },
    },
  },
};

export const Rtl: Story = {
  args: { rtl: true },
  parameters: {
    docs: {
      description: {
        story: 'Logical properties throughout, so the whole card mirrors — emblem, name, seed and score.',
      },
    },
  },
};

export const States: Story = {
  render: (args) => ({ props: args, template: '<et-sb-match-card-states [surface]="surface" />' }),
  parameters: {
    docs: {
      description: {
        story:
          'Every state at all three layouts, side by side: scheduled, live, finished, a best-of-three, a ' +
          'best-of-seven, table points, W/L outcomes, and a TBD slot.',
      },
    },
  },
};
