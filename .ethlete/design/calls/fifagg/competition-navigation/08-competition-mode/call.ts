import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Fifagg · call 8',
  headline: 'How much navigation should competition mode expose at rest?',
  intro:
    'Every answer replaces the global header while the visitor is inside this competition. FIFAe becomes an explicit back action, the competition owns the visual theme, search is scoped, and the old overflowing page-tab strip disappears.',
  frameWidth: 1400,
  rounds: [
    {
      key: 'r1',
      title: 'Competition-mode density',
      note: 'Direct destinations won: the transformed header should make the mode change unmistakable, keep common destinations immediate, and collapse the complete map into the mobile menu. The FIFAe mark must remain present.',
    },
    {
      key: 'r2',
      title: 'Persistent shell behavior',
      note: 'Rejected as separate answers: the persistent bar keeps destinations visible but lacks room for stage context, while hover expansion makes the competition map too dependent on discovery. The next pass combines the stable shell with an attached local row.',
    },
    {
      key: 'r3',
      title: 'Attached row on scroll',
      note: 'Rejected as drawn: all three variants replaced or modified the global header. The FIFAe platform header must remain the source implementation; competition navigation is an independent row attached beneath it.',
    },
    {
      key: 'r4',
      title: 'Independent sub-navigation on scroll',
      note: '',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Direct destinations',
      claim:
        'The transformed desktop bar exposes the most-used competition destinations directly; its menu holds the complete map and serves mobile.',
      cost: 'The available width determines which links earn permanent placement, so the visible subset needs a stable rule.',
      verdict: 'chosen',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Identity plus menu',
      claim:
        'Competition mode changes the identity and search scope, but keeps every destination inside one clearly labelled menu.',
      cost: 'The hierarchy is calm and responsive, but every local move costs an extra action.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Dedicated local row',
      claim:
        'A themed identity bar sits above a complete local row, making the competition map continuously visible on desktop.',
      cost: 'It is the clearest map but restores much of the vertical and horizontal pressure the original tab strip caused.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
    {
      key: 'd',
      round: 'r2',
      name: 'D · Always-present mode',
      claim:
        'The FIFAe logo, competition identity, direct destinations, compact scoped search and user center share one persistent bar.',
      cost: 'Competition links remain discoverable, but the bar is denser and long labels need strict prioritization.',
      verdict: 'rejected',
      load: () => import('./option-d'),
    },
    {
      key: 'e',
      round: 'r2',
      name: 'E · Hover-expanded mode',
      claim:
        'The persistent bar keeps the FIFAe logo, a compact competition trigger, scoped search and user center; hover or focus opens the local map using the current header behavior.',
      cost: 'The resting shell is spacious, but competition destinations are one interaction away and touch needs the equivalent tap behavior.',
      verdict: 'rejected',
      load: () => import('./option-e'),
    },
    {
      key: 'f',
      round: 'r3',
      name: 'F · Merge into the primary bar',
      claim:
        'The attached local row is complete at the top of the page, then its overview identity and current-stage control merge into the primary bar on scroll.',
      cost: 'The compact state is efficient, but static competition links leave the bar and require reopening the competition menu.',
      verdict: 'rejected',
      load: () => import('./option-f'),
    },
    {
      key: 'g',
      round: 'r3',
      name: 'G · Compress as a slim rail',
      claim:
        'The local row remains attached on scroll but reduces to a shallow rail containing overview, key links, the live stage and the competition menu.',
      cost: 'The competition remains highly legible, but two header rows continue consuming vertical space.',
      verdict: 'rejected',
      load: () => import('./option-g'),
    },
    {
      key: 'h',
      round: 'r3',
      name: 'H · Hide with a recall control',
      claim:
        'The local row leaves on scroll and a themed competition control in the primary bar restores it on demand.',
      cost: 'It gives content the most room, but once collapsed the local destinations are hidden behind another action.',
      verdict: 'rejected',
      load: () => import('./option-h'),
    },
    {
      key: 'i',
      round: 'r4',
      name: 'I · Keep the full row',
      claim:
        'The source global header remains unchanged and the complete competition row stays attached beneath it at every scroll position.',
      cost: 'Nothing moves or disappears, but the two-row stack permanently consumes the most vertical space.',
      load: () => import('./option-i'),
    },
    {
      key: 'j',
      round: 'r4',
      name: 'J · Compress the local row',
      claim:
        'The source global header remains unchanged while the attached competition row compresses to overview, key links, live stage and menu on scroll.',
      cost: 'The compact state retains useful context, but the row visibly changes density while scrolling.',
      load: () => import('./option-j'),
    },
    {
      key: 'k',
      round: 'r4',
      name: 'K · Collapse to an attached handle',
      claim:
        'The source global header remains unchanged while the competition row collapses to a themed handle directly beneath it.',
      cost: 'The page regains vertical space, but reopening the competition map requires an extra action.',
      load: () => import('./option-k'),
    },
  ],
});
