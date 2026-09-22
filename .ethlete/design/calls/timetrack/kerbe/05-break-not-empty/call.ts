import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 5',
  headline: 'A break that is not empty',
  intro:
    'Call 4 made the break a rule across the whole day. Two things were left open. An agent can run while nobody is at the machine, so a break is not proof that nothing happened: every frame below adds one agent band that starts at 12:30, inside the 12:15 break, and ends 15m after it. And the break now names itself inside its own block instead of in the gutter. The second break at 15:30 stays empty, so both cases read in one picture.',
  frameWidth: 1100,
  options: [
    {
      key: 'a',
      name: 'A · The work sits on the break',
      claim:
        'The rule is washed across every lane and the band draws on top of it. The break says when it was, the band says what still ran.',
      cost: 'The wash reads as a claim that the lane was idle, and the band contradicts it in the same pixels.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · The break is a frame, not a fill',
      claim: 'Two hairlines and the label, no wash at all. Nothing is behind the band, so nothing can contradict it.',
      cost: 'A 15m break is 2rem between two lines, which is close to what a hairline pair already means elsewhere.',
      verdict: 'chosen',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The break parts around the work',
      claim:
        'The hairlines still span the day, but the wash stops in a lane that was busy. The break marks the time and stays honest about the lane.',
      cost: 'The washed and unwashed cells make the rule look broken, and the label can land over a band in the first lane.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
