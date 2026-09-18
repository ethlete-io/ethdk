import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'the shell',
  eyebrow: 'Design tool · call 6',
  headline: 'How does Studio hold three columns and what is left of the top bar?',
  intro:
    'Studio draws one strip of chrome across the top that holds the project name, a Projects button, the checkout path, a Reload button and the server line. The work itself wants three columns: the call explorer, the workspace with its variants, and the chat. Each option keeps the same three columns and moves the chrome somewhere else. All three draw the @ethlete surface and colour tokens, so what wins can be built with @ethlete/components.',
  frameWidth: 1440,
  rounds: [
    {
      key: 'r1',
      title: 'Where the chrome goes',
      note: '',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · The top bar holds the switcher',
      claim:
        'The project name moves into the head of the explorer. The top bar keeps only what is about the open call: the variant switcher, centred over the workspace.',
      cost: 'A strip of chrome still crosses all three columns, so the chat and the explorer start lower than they need to.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · The switcher rides the workspace',
      claim:
        'The switcher sits inside the workspace, above the drawing it switches. The top bar shrinks to one thin line for the checkout and the server.',
      cost: 'The line across the top holds two things a reader looks at once a day.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · No top bar at all',
      claim:
        'Every column owns its own head and foot. The checkout and the server line drop into the foot of the explorer, and the three columns run the full height of the window.',
      cost: 'The checkout path is no longer in one fixed place, and the foot of the explorer holds two unrelated things.',
      load: () => import('./option-c'),
    },
  ],
});
