import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 10',
  headline: 'What the title bar carries',
  intro:
    'The sketch draws a brass KERBE mark, the date and the day total, and no control at all. The app ships the opposite: a previous and next day, a Today step, Add an entry and Debug, and no total. Neither bar was designed, and they do not agree on one item. Every frame draws the same day, with the gutter as call 9 settled it and the headers as call 8 settled it. Only the top row changes. The buttons are drawn in Kerbe material as a placeholder - how a button looks is not this call.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'What the top row carries',
      note: '',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · The sketch as drawn',
      claim:
        'KERBE in brass mono, the date at 1.3rem in --k-ink, and the day total in mono at --k-ink-3. It is the quietest bar of the four, and it says what day this is and what it came to.',
      cost: 'There is no way to reach yesterday, and no way to add an entry. The app can do both today, so this frame drops working behaviour to look calm.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · The app‘s own bar, in Kerbe',
      claim:
        'What the app ships, drawn in the new material: a previous and next day around the date, a Today step when the day is not today, and Add an entry and Debug at the right. Nothing is invented and nothing is lost.',
      cost: 'The mark and the day total both go. The four lane headers say where the day went, but no single number says what the day came to.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · B, and the day total returns',
      claim:
        'B, and the total sits at the right of the row before the buttons, in mono at --k-ink-3. The bar keeps every control and says what the day came to, which is the one fact no lane header holds.',
      cost: 'Five things share one row. On a narrow window the total is the item with the least to say and the first that has to wrap.',
      load: () => import('./option-c'),
    },
    {
      key: 'd',
      round: 'r1',
      name: 'D · C, and the mark returns in ink',
      claim:
        'C, and KERBE leads the row again - in --k-ink-3, not brass. Call 6 ruled that brass says a band asks the reader for something, so the window wears the name in ink and the metal stays in the field.',
      cost: 'The mark is the one item in the bar the reader never needs. It costs the row its width and gives back only the brand.',
      load: () => import('./option-d'),
    },
  ],
});
