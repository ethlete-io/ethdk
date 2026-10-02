import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Scheduler contrast',
  eyebrow: 'Components · scheduler · call 0',
  headline: 'How does an appointment set its time and location apart from its title?',
  intro:
    'An appointment chip draws its title, its time range and its location in the theme ink on a 14% tint of the fill. The time and the location take opacity 0.75, which drops them to 2.9-3.7:1 on both surfaces. Each frame draws one chip per theme on dark and on light, plus a selected chip, with the contrast of the title and of the time. The dark warning title fails in every frame: the warning theme has no dark ink, which is a separate call. A red number is under 4.5:1.',
  frameWidth: 720,
  rounds: [
    {
      key: 'r1',
      title: 'Secondary text',
      note: 'C won: the opacity goes and the title takes weight 600, so the weight carries the step the opacity carried and every chip clears AA. A fails AA, B loses the hierarchy, and D makes the time louder than the title on dark.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · Shipped',
      claim: 'Time and location at opacity 0.75 of the ink, so they read one step quieter than the title.',
      cost: 'Under AA on every theme on light, and on warning and danger on dark.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · Full ink',
      claim: 'The opacity goes. Time and location take the full ink, so they have the same contrast as the title.',
      cost: 'Nothing sets the title apart any more except its place at the start of the chip.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'chosen',
      round: 'r1',
      name: 'C · Full ink, bold title',
      claim: 'The opacity goes, and the title takes weight 600. The weight carries the step the opacity carried.',
      cost: 'A month of chips gets heavier, and a bold title truncates a few characters earlier.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r1',
      name: 'D · Neutral time and location',
      claim: 'Time and location take the surface text colour at full strength. Only the title carries the theme ink.',
      cost: 'A chip holds two text colours, and on dark the near-white time is louder than the tinted title.',
      load: () => import('./variant-d'),
    },
  ],
});
