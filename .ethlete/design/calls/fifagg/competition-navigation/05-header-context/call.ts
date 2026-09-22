import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Fifagg · call 5',
  headline: 'Can the site header carry the competition map?',
  intro:
    'Both answers move competition orientation into the existing FIFAe header, leaving the page below to start directly with its content. Each drawing shows the menu open at desktop and mobile widths so the hand-off from global navigation to this competition is explicit.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'Header ownership',
      note: "Rejected: the proposed header did not preserve FIFAe's actual icon-led global navigation, so it cannot answer whether competition navigation belongs in that system.",
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Current-competition chip',
      claim:
        'A highlighted header chip names the current competition and opens its complete map; global sections remain ordinary header links.',
      cost: 'The selected competition is an additional header control, so a long title must be deliberately abbreviated on small screens.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Competition mode',
      claim:
        'The header switches into a competition mode: its secondary row holds the local map while the primary row continues to own global navigation.',
      cost: 'It preserves every destination visibly, but reintroduces a second band whenever a visitor enters a competition.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
  ],
});
