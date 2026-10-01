export type StatTileFormatter = (value: number) => string;

/** Intl options for `Intl.NumberFormat` in the app locale, or a function that returns the finished string. */
export type StatTileFormat = Intl.NumberFormatOptions | StatTileFormatter;

export type StatTileDirection = 'up' | 'down' | 'neutral';

export type StatTileGoodDirection = 'up' | 'down';

export type StatTileSentiment = 'good' | 'bad' | 'neutral';
