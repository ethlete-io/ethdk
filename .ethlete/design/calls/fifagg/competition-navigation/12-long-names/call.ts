import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 12',
  headline: 'How does the row carry a long competition name with no icon asset?',
  intro:
    'The mobile row already ran out of width with the short name, and the real one is "FIFAe World Cup 2026™ ft. eFootball™ Console". No competition ships an icon, only a banner image, so the square mark the earlier calls used does not exist. Every option draws the real name at 1400 and at 390.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · Two lines, one control',
      claim:
        'The competition takes the full width of the row on one line, and the live stage runs under it, so both keep their own line.',
      cost: 'The row is taller, and a very long name still ends in an ellipsis.',
      verdict: 'chosen',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Live only, name in the page',
      claim:
        'The row drops the competition name, which the page heading states anyway, and spends its width on the live stage.',
      cost: 'Once the visitor scrolls past the heading, nothing in the chrome names the competition.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The banner is the mark',
      claim:
        'The one asset every competition has becomes the row background, so the competition has a face without an icon.',
      cost: 'A photographic banner behind small text needs a heavy tint, and the row still truncates the name.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
