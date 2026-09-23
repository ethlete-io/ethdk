import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The agent surface',
  eyebrow: 'Studio · call 0',
  headline: 'Where the conversation with the agent lives',
  intro:
    'Studio puts three things on the screen that belong together and read as three: the prompt box a verb writes into, the list of what the run did, and everything said before. Each frame draws the same open call, the same seven turns, the same live action and the same full session, and changes only where that conversation sits against the drawing it is about.',
  frameWidth: 1280,
  rounds: [
    {
      key: 'r1',
      title: 'Where it sits',
      note: 'The right rail won. Width is the cheaper dimension to give up: a frame that runs out of height has nowhere to go, and the dock took the one thing a tall drawing needs. The drawer lost for hiding what was said behind a control, and for covering the drawing it talks about the moment it opens. So the conversation keeps a column of its own beside the drawing, oldest turn at the top, the prompt box at its foot.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      verdict: 'chosen',
      name: 'A · The right rail',
      claim:
        'One column at the right edge holds the whole conversation, oldest at the top, and the prompt box sits at its foot. The drawing keeps the rest of the width, so what was said and what it produced stay side by side.',
      cost: 'The column eats width a wide drawing wants, and a long answer wraps to many short lines in a narrow measure.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      verdict: 'rejected',
      name: 'B · The bottom dock',
      claim:
        'The conversation lies under the drawing across the full width, with the prompt box as its last row. A line of text reads at its natural measure, and the drawing keeps every pixel of width.',
      cost: 'The dock takes height from the drawing, which is the one dimension a tall frame cannot spare, and the reader looks down instead of across.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      verdict: 'rejected',
      name: 'C · The drawer',
      claim:
        'Only the prompt box and the live action stay on the screen. The conversation opens over the drawing when the reader asks for it, and closes again, so the drawing is never made smaller for words nobody is reading.',
      cost: 'What was said is out of sight, so a reader who wants the last answer has to open it, and the open drawer hides the thing it talks about.',
      load: () => import('./variant-c'),
    },
  ],
});
