import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 24',
  headline: 'What does the chip say about a stage that is over?',
  intro:
    'Call 23 kept a word behind the name when the date is gone. "next" holds; "ended" does not, because it reports a state nobody is waiting for. The chip is still a link, so the word can name what the tap gives instead. The big frame is the competition after it ends, and the strips below hold the live state, the next state, and a past stage whose name fills the chip.',
  frameWidth: 390,
  options: [
    {
      key: 'a',
      name: 'A · Name what the tap gives',
      claim: '"Final results". The word is the destination, not the status, so it earns its place in a link.',
      cost: 'A stage really named "Final" then reads as the adjective, and the chip promises a page of results that has to exist.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · Match the voice of the live row',
      claim:
        '"Final is over" is built like "Group Stage is live now": the same sentence, a different verb, so one voice covers every state.',
      cost: 'It is still a status, and it is the longest of the three, so it is the first thing the chip drops.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The date it happened',
      claim:
        '"Final 14 April". A past date states the past on its own, and a finished stage almost always has one, so no word is invented.',
      cost: 'It breaks the call 23 rule that the chip carries a word and never a time, and a bare date does not say the competition is over.',
      load: () => import('./option-c'),
    },
  ],
});
