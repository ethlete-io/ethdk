const FILLER =
  'Sed euismod nisl nec ultricies. Aenean vulputate eleifend tellus. Curabitur ullamcorper ultricies nisi.';
const MEDIA_RATIOS = [1, 1.35, 0.8, 1.7];

export type Card = {
  id: number;
  paragraphs: string[];
  mediaRatio: number;
};

export const MASONRY_FILLER = FILLER;

const pseudoRandom = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;

  return value - Math.floor(value);
};

export const createCards = (count: number): Card[] =>
  Array.from({ length: count }, (_, id) => ({
    id,
    paragraphs: Array.from({ length: 1 + Math.floor(pseudoRandom(id + 1) * 5) }, () => FILLER),
    mediaRatio: MEDIA_RATIOS[id % MEDIA_RATIOS.length] ?? 1,
  }));
