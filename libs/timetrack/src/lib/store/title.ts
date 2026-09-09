import { CollectedEvent } from '../model/event';

/**
 * A URL inside a title, and the query string or fragment that follows it. The host must end in a
 * label of letters, so a version number is not mistaken for one.
 */
const URL_WITH_QUERY = /(https?:\/\/[^\s?#]+|[a-z0-9][\w-]*(?:\.[\w-]+)*\.[a-z]{2,}(?:\/[^\s?#]*)?)[?#]\S+/gi;

/**
 * The title with the query string and the fragment of every URL in it removed. The origin and the path
 * are kept, so the row still says which page the time was spent on.
 */
export const redactTitleUrls = (title: string) => title.replace(URL_WITH_QUERY, '$1');

/**
 * Every event's title with `redactTitleUrls` applied. Run it after the exclusion rules and before the
 * store: a rule is written against the title the user saw, and a browser puts the whole URL in the
 * title while a page has none of its own, so a sign-in redirect carries an OAuth request and its
 * tokens into the database.
 */
export const redactEventTitles = <T extends CollectedEvent>(events: readonly T[]): T[] =>
  events.map((event) => {
    if (!('title' in event) || typeof event.title !== 'string') return event;

    const title = redactTitleUrls(event.title);

    return title === event.title ? event : ({ ...event, title } as T);
  });
