import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 0',
  headline: 'The band is an inlay',
  intro:
    'The same afternoon, four times. Nothing here refines what the app draws today. Each frame is a different answer to "what makes a band visible", and all four are flat first, with one deco gesture that carries a meaning. Read the metal: dim is a band that asks nothing, brass is a glance, lit brass is a yes or a no, patina waits on a ticket.',
  frameWidth: 330,
  options: [
    {
      key: 'a',
      name: 'A · Inlay',
      claim:
        "A flat plate with a strip of metal set into its left edge. The strip runs the band's whole length, and its colour alone says what the band asks.",
      cost: 'The strip took two revisions to read as a gesture: broken in its middle it read as a hole, and cut short it read as a defect next to a full one.',
      verdict: 'chosen',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Plate',
      claim: 'A raised panel framed in the metal, with corner brackets that close on a band that asks.',
      cost: 'The named runner-up, kept as the fallback rather than the direction.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · Tally',
      claim:
        'No panel. One cut stick down the left edge, straight off the mark, and the most on-brand of the four as well as the quietest.',
      cost: 'The metal alone cannot separate two bands that touch.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
    {
      key: 'd',
      name: 'D · Rule',
      claim: 'Hairlines only. Each band is an open bracket cut into the ground.',
      cost: 'Elegant, and two touching bands run into each other.',
      verdict: 'rejected',
      load: () => import('./option-d'),
    },
  ],
});
