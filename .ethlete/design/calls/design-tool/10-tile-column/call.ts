import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'the workspace',
  eyebrow: 'Design tool · call 10',
  headline: 'How does the tile column hold twelve variants across four rounds?',
  intro:
    'Round 1 of call 6 lost because all three options traded this column for a segmented switcher. It is how a variant is picked and compared, so it stays. It has never been called on its own, and it has a problem the shell calls hid: a call that runs four rounds puts twelve tiles in a strip beside a canvas, and only three of them are still open. Each option draws the same twelve at the geometry call 8 settled, to the left of a full-bleed canvas.',
  frameWidth: 260,
  rounds: [
    {
      key: 'r1',
      title: 'What the column does with a round that has ruled',
      note: 'B wins. The round the reader is ruling on stays at the top at full size, and a settled round keeps one line with its winner, so the chain of winners reads down the column and nothing scrolls. A lost because nine ruled tiles pushed the three open ones off the screen. C lost because a stepper hides every earlier decision behind a control nobody presses.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Every round, every tile',
      claim:
        'One block per round, newest at the top, with every tile drawn at the same size. A settled round keeps its rejected tiles dimmed beside its winner, and the column scrolls.',
      cost: 'Nine of the twelve tiles have already ruled, so most of the column is history and the open round is what scrolls away first.',
      verdict: 'rejected',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · The open round is full size',
      claim:
        'The open round draws at full tile size. A settled round folds to one line holding its winner as a small chip, so every pass stays in reach without taking the height of a pass that has ruled.',
      cost: 'A rejected tile is no longer visible at all, so comparing the open round against what a past round rejected needs the fold opened first.',
      verdict: 'chosen',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · One round at a time',
      claim:
        'The column shows one round only, with a stepper at its head that walks the rounds. The tiles get the full height of the column, so they are drawn large enough to compare without opening one.',
      cost: 'Nothing in the column says what the earlier rounds decided, so the chain of winners is invisible until the reader steps back through it.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
  ],
});
