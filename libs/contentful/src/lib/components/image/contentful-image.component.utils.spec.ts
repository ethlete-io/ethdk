import { ContentfulGqlAsset } from '../../gql';
import { ContentfulRestAsset } from '../../types';
import {
  generateContentfulImageSources,
  generateDefaultContentfulImageSource,
  parseContentfulImageSize,
} from './contentful-image.component.utils';

const createRestAsset = (overrides?: Partial<ContentfulRestAsset['fields']['file']>): ContentfulRestAsset => ({
  sys: {
    type: 'Asset',
    id: 'asset-1',
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    locale: 'en-US',
  },
  fields: {
    title: 'Title',
    description: 'Description',
    file: {
      url: '//images.ctfassets.net/foo.png',
      details: { size: 100, image: { width: 800, height: 600 } },
      fileName: 'foo.png',
      contentType: 'image/png',
      ...overrides,
    },
  },
  metadata: { tags: [] },
});

const createGqlAsset = (overrides?: Partial<ContentfulGqlAsset>): ContentfulGqlAsset => ({
  sys: { id: 'gql-asset-1' },
  title: 'Title',
  contentType: 'image/png',
  url: '//images.ctfassets.net/gql.png',
  description: 'Description',
  width: 800,
  height: 600,
  size: 100,
  ...overrides,
});

describe('parseContentfulImageSize', () => {
  it('parses a plain number as a width', () => {
    expect(parseContentfulImageSize('400')).toEqual({ width: 400, height: null });
  });

  it('parses a "w" suffixed size as a width', () => {
    expect(parseContentfulImageSize('400w')).toEqual({ width: 400, height: null });
  });

  it('parses an "h" suffixed size as a height', () => {
    expect(parseContentfulImageSize('400h')).toEqual({ width: null, height: 400 });
  });

  it('parses an "x" separated size as width and height', () => {
    expect(parseContentfulImageSize('400x300')).toEqual({ width: 400, height: 300 });
  });

  it('parses a fully suffixed "x" separated size as width and height', () => {
    expect(parseContentfulImageSize('400wx300h')).toEqual({ width: 400, height: 300 });
  });

  it('returns null for both dimensions when the size is not parseable', () => {
    expect(parseContentfulImageSize('abc')).toEqual({ width: NaN, height: null });
  });
});

describe('generateContentfulImageSources', () => {
  it('creates one source per supported image type', () => {
    const sources = generateContentfulImageSources(createRestAsset(), ['400w'], null, null, null, null);

    expect(sources.map((s) => s.type)).toEqual(['image/avif', 'image/webp', 'image/png', 'image/jpg']);
  });

  it('assembles the format query param and a width descriptor srcset', () => {
    const sources = generateContentfulImageSources(createRestAsset(), ['400w', '800w'], null, null, null, null);

    expect(sources[0]?.srcset).toBe(
      '//images.ctfassets.net/foo.png?fm=avif&w=400 400w, //images.ctfassets.net/foo.png?fm=avif&w=800 800w',
    );
  });

  it('uses a height descriptor when only a height was given', () => {
    const sources = generateContentfulImageSources(createRestAsset(), ['300h'], null, null, null, null);

    expect(sources[1]?.srcset).toBe('//images.ctfassets.net/foo.png?fm=webp&h=300 300h');
  });

  it('uses the width descriptor when both width and height were given', () => {
    const sources = generateContentfulImageSources(createRestAsset(), ['400x300'], null, null, null, null);

    expect(sources[1]?.srcset).toBe('//images.ctfassets.net/foo.png?fm=webp&w=400&h=300 400w');
  });

  it('assembles bg, q, f and fit query params in order', () => {
    const sources = generateContentfulImageSources(createRestAsset(), ['400w'], '000000', 80, 'faces', 'fill');

    expect(sources[2]?.srcset).toBe(
      '//images.ctfassets.net/foo.png?fm=png&bg=rgb:000000&q=80&f=faces&fit=fill&w=400 400w',
    );
  });

  it('includes a quality of 0 (only null is skipped)', () => {
    const sources = generateContentfulImageSources(createRestAsset(), ['400w'], null, 0, null, null);

    expect(sources[0]?.srcset).toContain('q=0');
  });

  it('falls back to the plain url with query params when no sizes were given', () => {
    const sources = generateContentfulImageSources(createRestAsset(), [], null, null, null, null);

    expect(sources[3]).toEqual({ type: 'image/jpg', srcset: '//images.ctfassets.net/foo.png?fm=jpg' });
  });

  it('uses the flat url of a gql asset', () => {
    const sources = generateContentfulImageSources(createGqlAsset(), ['400w'], null, null, null, null);

    expect(sources[0]?.srcset).toBe('//images.ctfassets.net/gql.png?fm=avif&w=400 400w');
  });
});

describe('generateDefaultContentfulImageSource', () => {
  it('uses url and contentType of a gql asset', () => {
    expect(generateDefaultContentfulImageSource(createGqlAsset())).toEqual({
      type: 'image/png',
      srcset: '//images.ctfassets.net/gql.png',
    });
  });

  it('uses url and contentType of a rest asset', () => {
    expect(generateDefaultContentfulImageSource(createRestAsset())).toEqual({
      type: 'image/png',
      srcset: '//images.ctfassets.net/foo.png',
    });
  });

  it('returns an empty source when the rest asset has no url', () => {
    expect(generateDefaultContentfulImageSource(createRestAsset({ url: null }))).toEqual({ type: '', srcset: '' });
  });

  it('returns an empty source when the rest asset has no content type', () => {
    expect(generateDefaultContentfulImageSource(createRestAsset({ contentType: null }))).toEqual({
      type: '',
      srcset: '',
    });
  });

  it('returns an empty source when a gql asset has no content type', () => {
    // A gql asset without a `url` is not detected as a gql asset at all, so only
    // the missing content type case can be characterized here.
    expect(generateDefaultContentfulImageSource(createGqlAsset({ contentType: null }))).toEqual({
      type: '',
      srcset: '',
    });
  });
});
