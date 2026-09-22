import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Fifagg · call 1',
  headline: 'How does a long competition navigation open?',
  intro:
    'Each answer uses the same five static destinations and four stages, including an irrelevant completed play-in and the live Continental Championship. The frame shows both the normal page and the navigation opened at desktop and mobile widths.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'The entry model',
      note: 'Rejected: the complete competition structure is vital information and should remain visible wherever there is room, rather than hiding behind a modal.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Competition switcher',
      claim:
        'One compact control names the current destination and opens the complete competition map, grouped into pages and stages.',
      cost: 'The map is one deliberate extra action even for the next stage, and the trigger must earn its prominence.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Relevant stage plus browse',
      claim:
        'The live stage is a direct, persistent destination; a quieter Browse control exposes the whole map when the visitor needs it.',
      cost: 'It gives two entry points different weights, so the relationship between stage and page needs to stay unmistakable.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Two-level navigation',
      claim:
        'Static pages remain immediately visible while a single Stages item opens only the dynamic part of the structure.',
      cost: 'Static destinations still compete for horizontal space and the split can make one competition feel like two navigations.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
