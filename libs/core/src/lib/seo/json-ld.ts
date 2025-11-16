export type Context = {
  '@context': 'https://schema.org';
};

export type Thing = {
  '@type': string;
  name?: string;
  description?: string;
  url?: string;
  image?: string | string[];
};

export type Organization = Thing & {
  '@type': 'Organization';
  logo?: string;
  email?: string;
  telephone?: string;
  address?: PostalAddress;
};

export type Person = Thing & {
  '@type': 'Person';
  givenName?: string;
  familyName?: string;
  email?: string;
  jobTitle?: string;
};

export type Article = Thing & {
  '@type': 'Article';
  headline?: string;
  author?: Person | Organization;
  datePublished?: string;
  dateModified?: string;
};

export type WebPage = Thing & {
  '@type': 'WebPage';
  headline?: string;
  author?: Person | Organization;
  datePublished?: string;
};

export type PostalAddress = {
  '@type': 'PostalAddress';
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
};

export type BreadcrumbList = Thing & {
  '@type': 'BreadcrumbList';
  itemListElement: ListItem[];
};

export type ListItem = {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string;
};

export type SportsEvent = Thing & {
  '@type': 'SportsEvent';
  startDate?: string;
  endDate?: string;
  location?: Place;
  competitor?: SportsTeam | Person;
  organizer?: Organization | Person;
  sport?: string;
};

export type SportsTeam = Organization & {
  '@type': 'SportsTeam';
  athlete?: Person[];
  coach?: Person;
  memberOf?: SportsOrganization;
};

export type SportsOrganization = Organization & {
  '@type': 'SportsOrganization';
  sport?: string;
};

export type Place = Thing & {
  '@type': 'Place';
  address?: PostalAddress;
};

export type VideoGame = Thing & {
  '@type': 'VideoGame';
  genre?: string;
  publisher?: Organization;
  gamePlatform?: string | string[];
  playMode?: string;
};

export type VideoGameSeries = Thing & {
  '@type': 'VideoGameSeries';
  containsSeason?: CreativeWorkSeason[];
};

export type CreativeWorkSeason = Thing & {
  '@type': 'CreativeWorkSeason';
  seasonNumber?: number;
  startDate?: string;
  endDate?: string;
};

export type SportsActivityLocation = Place & {
  '@type': 'SportsActivityLocation';
};

export type WithContext<T extends Thing> = T & Context;

export type Graph = {
  '@context': 'https://schema.org';
  '@graph': Thing[];
};
