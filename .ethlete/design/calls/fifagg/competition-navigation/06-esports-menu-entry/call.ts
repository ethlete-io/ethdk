import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Fifagg · call 6',
  headline: 'Where does one competition enter the existing Esports menu?',
  intro:
    'The FIFAe mark, Gaming and Esports icon controls, search and login retain the supplied navigation’s geometry. The eFootball tab is active. This call changes only what that active game exposes: an entry to a competition, not the global shell or the page tabs.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'Competition entry inside Esports',
      note: 'Rejected: the real Esports menu already contains Competition Spotlight cards. Adding another competition entry duplicates the existing route and does not replace the competition page navigation.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Featured competition',
      claim:
        'The active game’s existing mega-menu gains one clearly labelled competition card before its ordinary destination columns.',
      cost: 'It makes the current tournament easy to find but offers only an entry, not an alternative in-place map.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Competition group',
      claim:
        'The active game’s menu gets a compact Competition column, alongside Matchups and Community, to hold its current and future tournaments.',
      cost: 'A dense global menu can obscure that the listed items are individual competitions rather than site-wide destinations.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
  ],
});
