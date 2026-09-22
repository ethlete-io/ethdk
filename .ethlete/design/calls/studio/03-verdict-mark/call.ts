import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The workbench',
  eyebrow: 'Studio · call 3',
  headline: 'How a thumbnail says it is ruled, without a word',
  intro:
    'Call 2 settled that a thumbnail carries no control, and the user ruled the word out too: a tile that says "rejected" spends its narrow width on text nobody needs to read twice. A tile has three states: chosen, rejected, and still open. Each frame draws the same settled workbench and the same eight variants, and changes only how the picture itself carries the state.',
  frameWidth: 1280,
  rounds: [
    {
      key: 'r1',
      title: 'What carries the state',
      note: 'C won. The column has to say how far a round has got, and only strength separates all three states without reading anything: a rejected tile falls back to about a third, an open one stands at full strength, and the chosen one carries the accent. B put the state in a hairline, and a dim hairline on a dark panel is close to no hairline at thumbnail size. A dropped the rejected state altogether, so a settled round and an untouched one look the same. The cost stands: a faded picture can no longer be compared with the winner, so a rejected variant has to be opened again to be read.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      verdict: 'rejected',
      name: 'A · Only the chosen one is coloured',
      claim:
        'One tile in the column carries the accent, and it is the winner. Everything else is drawn the same, so the eye finds the result of a settled round in one movement and nothing else asks for attention.',
      cost: 'A rejected tile and an open tile read the same, so the column never says how much of the round is still to rule.',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      verdict: 'rejected',
      name: 'B · A border per state',
      claim:
        'The frame around the picture says the state: the accent for chosen, a dim neutral for rejected, none at all for open. The picture is never touched, so two variants stay comparable whatever was ruled about them.',
      cost: 'A hairline at thumbnail size is a small signal, and a dim border on a dark panel is close to no border, so rejected and open are still easy to confuse.',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      verdict: 'chosen',
      name: 'C · The rejected ones fade',
      claim:
        'A rejected tile drops to about a third of its strength and falls back, an open tile stands at full strength, and the chosen one carries the accent. The three states separate at a glance, even out of the corner of the eye.',
      cost: 'A faded picture is hard to read, so a rejected variant can no longer be compared with the winner without opening it again.',
      load: () => import('./option-c'),
    },
  ],
});
