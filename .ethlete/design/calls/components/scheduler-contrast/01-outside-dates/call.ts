import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Scheduler contrast',
  eyebrow: 'Components · scheduler · call 1',
  headline: 'How does the month view set the dates of the next and the previous month apart?',
  intro:
    'The month view draws a date outside the shown month in the subtle surface text colour. That is 2.5:1 on light and 3.8:1 on dark, so axe fails it. The date number is aria-hidden, but the cell takes clicks and drops, so the WCAG exemption for inactive text is weak. Each frame draws two weeks on the four story surfaces, with the contrast of an outside date. A red number is under 4.5:1.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Outside dates',
      note: 'B won: outside dates take the muted colour, the step secondary text takes everywhere else, and clear AA on all four surfaces. A fails AA, C depends on a weight 300 the font may not have, and D fails AA on light because the shade darkens the cell.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim: 'Outside dates in the subtle colour. The step to an in-month date is large.',
      cost: 'Under AA on all four surfaces. Axe keeps the stories red, unless we accept the exemption.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'chosen',
      round: 'r1',
      name: 'B · Muted',
      claim: 'Outside dates in the muted colour, the same step that secondary text takes everywhere else.',
      cost: 'The step to an in-month date gets smaller, mainly on light.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Muted, weight 300',
      claim: 'Muted colour, and a thinner stroke gives back some of the step that the colour gives up.',
      cost: 'Weight 300 depends on the font. A font without it draws 400, so C becomes B.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Muted, shaded cell',
      claim:
        'Muted colour, and the outside cell takes a 4% tint of the text colour. The cell, not the date, carries the step.',
      cost: 'The tint darkens the cell, so muted drops to 4.2-4.4:1 on light and fails AA. A new fill must also not read as the draft tint.',
      load: () => import('./variant-d'),
    },
  ],
});
