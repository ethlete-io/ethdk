import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 11',
  headline: 'What opens when the competition row is used?',
  intro:
    'Call 10 chose the live-led row. Today the strip mixes two different things: three pages about the competition, and four stage children that carry an executionStatus. Both mechanisms already ship: the mega panel under the global bar on desktop, and the drill-in drawer on mobile. Every option draws the open state at 1400 and at 390.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · One mega panel',
      claim:
        'Both controls open the same panel under the bar: the pages, the stage rail with its status marks, and the live stage as a card.',
      cost: 'One panel holds everything, so it is tall, and the live chip loses a direct answer of its own.',
      verdict: 'chosen',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Two anchored menus',
      claim:
        'The live chip opens the stage rail under itself, the way the stage picker already works; the map control keeps the pages.',
      cost: 'Each control answers its own question, but the competition map is split over two surfaces.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · Spotlight leads the panel',
      claim: 'One panel again, but the live stage takes the lead column, so the open state repeats what the row says.',
      cost: 'The live stage is stated twice, and the pages are pushed to the far edge.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
