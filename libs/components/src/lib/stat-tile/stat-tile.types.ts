export type StatTileFormatter = (value: number) => string;

/** Intl options for `Intl.NumberFormat` in the app locale, a function that returns the finished string, or `'rank'` for `#<n>`. */
export type StatTileFormat = Intl.NumberFormatOptions | StatTileFormatter | 'rank';

export type StatTileAlign = 'start' | 'center';

export type StatTileLabelPosition = 'above' | 'below';

export type StatTileDirection = 'up' | 'down' | 'neutral';

export type StatTileGoodDirection = 'up' | 'down';

export type StatTileSentiment = 'good' | 'bad' | 'neutral';
