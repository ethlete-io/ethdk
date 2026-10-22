import { NormalizedMatchParticipant } from '@ethlete/components';

const crest = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="30" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

export const BANNER_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
      '<rect width="100%" height="100%" fill="#123b2f"/>' +
      '<text x="50%" y="50%" fill="#00ffa1" font-family="sans-serif" font-size="34" text-anchor="middle" ' +
      'dominant-baseline="middle">Regionalliga Nordost</text></svg>',
  );

const team = (config: {
  id: string;
  name: string;
  code: string;
  subtitle: string | null;
  fill: string;
  seed: number;
}) => ({
  id: config.id,
  name: config.name,
  code: config.code,
  subtitle: config.subtitle,
  emblem: { defaultSrc: crest({ label: config.code, fill: config.fill }) },
  seed: config.seed,
});

const HOME: NormalizedMatchParticipant = team({
  id: 'fcb',
  name: 'FC Berlin',
  code: 'FCB',
  subtitle: 'Berlin eSports',
  fill: '#00ffa1',
  seed: 1,
});

const AWAY: NormalizedMatchParticipant = team({
  id: 'neo',
  name: 'Neon Esports',
  code: 'NEO',
  subtitle: 'Neon Gaming Group',
  fill: '#00d0ff',
  seed: 4,
});

export const RECIPE_PARTICIPANTS = [HOME, AWAY];
