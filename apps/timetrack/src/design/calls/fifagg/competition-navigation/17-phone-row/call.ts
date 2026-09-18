import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'competition navigation',
  eyebrow: 'Fifagg · call 17',
  headline: 'What does the phone row carry, now that the name is not its job?',
  intro:
    'The shipped page states the competition name twice already: inside the banner art, and again as the page heading right below the header. A third copy in the row buys nothing and costs four lines on a phone, so the name is out. Drawn at 390px, with the shipped banner, the page heading and the Overview/Tournament tabs below, so the row is judged against what the page really shows.',
  frameWidth: 390,
  options: [
    {
      key: 'a',
      name: 'A · One control, the live stage',
      claim:
        'The row is a single full-width control: the stage that runs now, and a chevron that opens the map for everything else.',
      cost: 'Every page move costs two taps, and the row says nothing about which page you are on.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · The page and the stage',
      claim:
        'Two controls: the page you are on, which opens the page list, and the live stage beside it. Both jobs are one tap away.',
      cost: 'Two menus on one row, and a long page name has to be cut inside the left control.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · The pages scroll, the stages are an icon',
      claim: 'Every page stays visible in a scrolling strip, and the stages collapse into one icon at the right.',
      cost: 'It is the strip the redesign set out to replace, and the live stage loses its name.',
      load: () => import('./option-c'),
    },
  ],
});
