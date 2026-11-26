import { NormalizedMatchParticipant } from '@ethlete/components';

const emblem = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="34" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

export const HOME: NormalizedMatchParticipant = {
  id: 'fcb',
  name: 'FC Berlin',
  code: 'FCB',
  subtitle: 'Berlin eSports',
  emblem: { defaultSrc: emblem({ label: 'FCB', fill: '#00ffa1' }) },
  seed: 1,
};

export const AWAY: NormalizedMatchParticipant = {
  id: 'neo',
  name: 'Neon Esports',
  code: 'NEO',
  subtitle: 'Neon Gaming Group',
  emblem: { defaultSrc: emblem({ label: 'NEO', fill: '#00d0ff' }) },
  seed: 8,
};

export const KICK_OFF = new Date('2026-05-02T18:30:00Z');
