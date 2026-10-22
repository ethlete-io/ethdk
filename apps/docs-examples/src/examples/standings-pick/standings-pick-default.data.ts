import { StandingPick } from '@ethlete/bracket';
import { NormalizedMatchParticipant } from '@ethlete/components';

const crest = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="30" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

const participant = (config: { id: string; name: string; code: string; fill: string }): NormalizedMatchParticipant => ({
  id: config.id,
  name: config.name,
  code: config.code,
  subtitle: null,
  emblem: { defaultSrc: crest({ label: config.code, fill: config.fill }) },
  seed: null,
});

export const PARTICIPANTS: NormalizedMatchParticipant[] = [
  participant({ id: 'fcb', name: 'FC Berlin', code: 'FCB', fill: '#00ffa1' }),
  participant({ id: 'neo', name: 'Neon Esports', code: 'NEO', fill: '#00d0ff' }),
  participant({ id: 'rlp', name: 'Rote Löwen Pankow', code: 'RLP', fill: '#ffd000' }),
  participant({ id: 'haf', name: 'Hafen United', code: 'HAF', fill: '#ff7a00' }),
];

export const STORED_PICKS: StandingPick[] = [{ position: 1, participantId: 'rlp' }];
