import { StatTileDirection, StatTileFormat, StatTileGoodDirection, StatTileSentiment } from './stat-tile.types';

const COMPACT_FROM = 10_000;

const autoCompactOptions = (value: number): Intl.NumberFormatOptions => ({
  maximumFractionDigits: 1,
  notation: Math.abs(value) >= COMPACT_FROM ? 'compact' : 'standard',
});

export type StatTileNumberFormatOptions = {
  format: StatTileFormat | null;
  locale: string;
  defaults?: Intl.NumberFormatOptions;
};

export const formatStatTileNumber = (value: number, { format, locale, defaults }: StatTileNumberFormatOptions) => {
  if (typeof format === 'function') return format(value);

  return new Intl.NumberFormat(locale, { ...defaults, ...(format ?? autoCompactOptions(value)) }).format(value);
};

export const statTileDirection = (delta: number): StatTileDirection => {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';

  return 'neutral';
};

export const statTileSentiment = (
  direction: StatTileDirection,
  goodDirection: StatTileGoodDirection | null,
): StatTileSentiment => {
  if (direction === 'neutral' || !goodDirection) return 'neutral';

  return direction === goodDirection ? 'good' : 'bad';
};
