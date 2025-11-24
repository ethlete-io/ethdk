import { Observable } from 'rxjs';

export type MaybeObservable<T> = T | Observable<T>;

export type SeoConfig = {
  title?: MaybeObservable<string>;
  description?: MaybeObservable<string>;
  keywords?: MaybeObservable<string[]>;
  icon?: MaybeObservable<string>;
  themeColor?: MaybeObservable<string>;
  colorScheme?: MaybeObservable<'light' | 'dark'>;
  robots?: MaybeObservable<string>;
  canonical?: MaybeObservable<string>;
  alternate?: MaybeObservable<AlternateLink>[];
  og?: MaybeObservable<OpenGraph>;
  twitter?: MaybeObservable<TwitterCard>;
  facebook?: MaybeObservable<FacebookCard>;

  [key: string]: MaybeObservable<unknown>;
};

export type AlternateLink = {
  href: string;
  hreflang: string;
};

export type OpenGraph = {
  title?: MaybeObservable<string>;
  description?: MaybeObservable<string>;
  type?: MaybeObservable<string>;
  url?: MaybeObservable<string>;
  image?: MaybeObservable<string>;
  siteName?: MaybeObservable<string>;
  locale?: MaybeObservable<string>;
  localeAlternate?: MaybeObservable<string[]>;
};

export type TwitterCard = {
  card?: MaybeObservable<string>;
  site?: MaybeObservable<string>;
  creator?: MaybeObservable<string>;
  title?: MaybeObservable<string>;
  description?: MaybeObservable<string>;
  image?: MaybeObservable<string>;
  imageAlt?: MaybeObservable<string>;
};

export type FacebookCard = {
  title?: MaybeObservable<string>;
  description?: MaybeObservable<string>;
  image?: MaybeObservable<string>;
  imageAlt?: MaybeObservable<string>;
  type?: MaybeObservable<string>;
  url?: MaybeObservable<string>;
  siteName?: MaybeObservable<string>;
  locale?: MaybeObservable<string>;
  localeAlternate?: MaybeObservable<string[]>;
};
