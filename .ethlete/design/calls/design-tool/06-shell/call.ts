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
      note: 'All three rejected. Every option traded the variant tiles for a segmented switcher, and the tiles are not chrome: the column of previews to the left of the drawing is how a variant is picked and compared. The next pass keeps that column and moves only the chrome around it.',
    },
    {
      key: 'r2',
      title: 'The chrome, with the tiles kept',
      note: 'F wins. Nothing crosses the top of the window, so the three columns start at the same line and the work gets the whole height. The checkout, Reload, the server and the agent are read once a day, and a status bar across the foot is where an editor already trains a reader to look for them. D lost because the foot of the explorer then holds three unrelated things; E lost because a bar cut to the columns is still a bar across all three.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · The top bar holds the switcher',
      claim:
        'The project name moves into the head of the explorer. The top bar keeps only what is about the open call: the variant switcher, centred over the workspace.',
      cost: 'A strip of chrome still crosses all three columns, so the chat and the explorer start lower than they need to.',
      verdict: 'rejected',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · The switcher rides the workspace',
      claim:
        'The switcher sits inside the workspace, above the drawing it switches. The top bar shrinks to one thin line for the checkout and the server.',
      cost: 'The line across the top holds two things a reader looks at once a day.',
      verdict: 'rejected',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · No top bar at all',
      claim:
        'Every column owns its own head and foot. The checkout and the server line drop into the foot of the explorer, and the three columns run the full height of the window.',
      cost: 'The checkout path is no longer in one fixed place, and the foot of the explorer holds two unrelated things.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      round: 'r2',
      name: 'D · The explorer swallows the chrome',
      claim:
        'There is no top bar. The left sidebar owns every piece of chrome: the project name and the Projects control are its head, the checkout path, Reload and the server line sit in its foot. The three columns run the full height of the window.',
      cost: 'The foot of the explorer holds three things that have nothing to do with each other, and the checkout path is far from the work it describes.',
      verdict: 'rejected',
      load: () => import('./variant-d'),
    },
    {
      key: 'e',
      round: 'r2',
      name: 'E · A title bar, cut to the columns',
      claim:
        'One thin bar crosses the top, aligned to the columns below it: the project and the Projects control over the explorer, the checkout path and Reload over the workspace, the server line over the chat. It carries no variant switcher; the tiles do that job.',
      cost: 'A strip of chrome still crosses all three columns, so every column starts 44px lower than it needs to.',
      verdict: 'rejected',
      load: () => import('./variant-e'),
    },
    {
      key: 'f',
      round: 'r2',
      name: 'F · A status bar at the foot',
      claim:
        'Nothing crosses the top. The project name and the Projects control head the explorer, and everything a reader looks at once a day drops to one thin status bar across the bottom of the window: the checkout, Reload, the server and the agent.',
      cost: 'The bottom of the window is the last place a reader looks, so the server line reports a stopped server where nobody sees it.',
      verdict: 'chosen',
      load: () => import('./variant-f'),
    },
  ],
});
