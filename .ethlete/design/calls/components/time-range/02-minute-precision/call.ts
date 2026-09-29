import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The time range picker',
  eyebrow: 'Components · call 2',
  headline: 'How a drag lands on a 5-minute step',
  intro:
    'Call 1 chose one drag with a live readout. The default minute step is 5, so the ring has 288 stops of about 2.4px. Every frame draws the drag at 14:35, a value off the 15-minute grid. A drawing cannot move, so each frame shows the state that tells the user which mode the drag is in.',
  frameWidth: 360,
  rounds: [
    {
      key: 'r1',
      title: 'Four ways to land',
      note: 'A won, decided after r2: a plain snap to the minute step with the live readout, as iOS Bedtime does. A mouse hits 2.4px stops with ease. B and C hide their mode. D lost first: its buttons are 30 by 20px, too small for a finger.',
    },
    {
      key: 'r2',
      title: 'The nudge at touch size',
      note: 'Both lost to A of r1. A nudge adds a control the plain snap does not need.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'chosen',
      round: 'r1',
      name: 'A · Plain snap to the step',
      claim:
        'H of call 1 as it is. The drag snaps to 5 minutes, and the readout is the only help. iOS Bedtime does the same.',
      cost: 'On a mouse or a small phone, 2.4px per stop makes the value jump while the hand tries to stay still.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · Pull out for fine steps',
      claim:
        'On the ring the drag snaps to 15 minutes. A finger that moves outward past the dashed line drags at 5 minutes, like the scrub speed of an iOS video: a longer lever turns the same distance into less time.',
      cost: 'Nothing shows the mode until the user finds it, and the outer band needs room the panel does not have on a phone.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Slow down for fine steps',
      claim:
        'A fast drag snaps to 15 minutes. When the hand slows, the drag snaps to 5, and a short scale under the readout shows the minutes around the value.',
      cost: 'A mode chosen by speed is invisible and can switch by mistake, and the scale takes the centre of the ring.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      round: 'r1',
      verdict: 'rejected',
      name: 'D · Drag at 15, nudge by 5',
      claim:
        'The drag snaps to 15 minutes only, so it always lands. Two small buttons under the readout move the value by one minute step.',
      cost: 'The buttons repeat the stepper that lost in call 1, and 14:35 costs a drag and a tap.',
      load: () => import('./variant-d'),
    },
    {
      key: 'e',
      verdict: 'rejected',
      round: 'r2',
      name: 'E · The nudge as a row under the ring',
      claim:
        'D, with the two buttons moved under the ring at 44px high. Each is a full finger target and names its step.',
      cost: 'The panel grows by one row, and the row looks like the minute chips that felt odd in call 1.',
      load: () => import('./variant-e'),
    },
    {
      key: 'f',
      verdict: 'rejected',
      round: 'r2',
      name: 'F · Swipe the centre to nudge',
      claim:
        'The drag snaps to 15. The whole centre disc, about 116px, is one target: a swipe up or down, or the mouse wheel, moves one minute step. The chevrons show it can move.',
      cost: 'A swipe is less easy to find than a button, and a screen reader needs the handle as a slider anyway.',
      load: () => import('./variant-f'),
    },
  ],
});
