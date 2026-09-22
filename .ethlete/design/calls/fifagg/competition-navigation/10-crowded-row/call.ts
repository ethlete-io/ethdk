import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 10',
  headline: 'What does the second row hold when seven destinations do not fit?',
  intro:
    'Call 9 chose the two-row header card. On a phone the current strip shows about two of its seven destinations, and the stage that runs now sits in sixth place, so a live final is invisible. Every option draws the same card at 1400 and at 390.',
  frameWidth: 1400,
  options: [
    {
      key: 'a',
      name: 'A · One map control',
      claim:
        'The row never lists destinations. It names the competition and the current page, and one control opens the complete map.',
      cost: 'Nothing scrolls and both widths read the same, but every move inside the competition costs an extra action.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Live stage leads',
      claim:
        'The stage that runs now takes the place the strip wasted, so a live final is the first thing the row says.',
      cost: 'The row changes with the competition calendar, and a competition with nothing live falls back to the current page.',
      verdict: 'chosen',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · Pinned live, strip below',
      claim:
        'The destination strip stays and still scrolls, but the identity and the live stage sit outside it and never scroll away.',
      cost: 'It keeps the full map visible on desktop, but the phone pays a third row and the strip still hides most of itself.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
