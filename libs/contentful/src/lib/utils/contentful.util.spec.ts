import { ContentfulEntry } from '../types';
import { isContentfulEntryType } from './contentful.util';

const entry = (contentTypeId: string) =>
  ({
    sys: { contentType: { sys: { id: contentTypeId, type: 'Link', linkType: 'ContentType' } } },
    fields: {},
    metadata: { tags: [] },
  }) as unknown as ContentfulEntry;

describe('isContentfulEntryType', () => {
  it('matches the content type id exactly', () => {
    expect(isContentfulEntryType(entry('teaser'), 'teaser')).toBe(true);
    expect(isContentfulEntryType(entry('teaser'), 'Teaser')).toBe(false);
    expect(isContentfulEntryType(entry('teaserList'), 'teaser')).toBe(false);
    expect(isContentfulEntryType(entry(''), '')).toBe(true);
  });
});
