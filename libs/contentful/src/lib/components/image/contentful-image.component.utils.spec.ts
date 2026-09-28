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
    expect(parseContentfulImageSize('abc')).toEqual({ width: null, height: null });
  });
});

describe('generateContentfulImageSources', () => {
  it('creates one source per supported image type', () => {
    const sources = generateContentfulImageSources(createRestAsset(), { srcsetSizes: ['400w'] });

    expect(sources.map((s) => s.type)).toEqual(['image/avif', 'image/webp']);
  });

  it('assembles the format query param and a width descriptor srcset', () => {
    const sources = generateContentfulImageSources(createRestAsset(), { srcsetSizes: ['400w', '800w'] });

    expect(sources[0]?.srcset).toBe(
      '//images.ctfassets.net/foo.png?fm=avif&w=400 400w, //images.ctfassets.net/foo.png?fm=avif&w=800 800w',
    );
  });

  it('derives a valid width descriptor when only a height was given', () => {
    const sources = generateContentfulImageSources(createRestAsset(), { srcsetSizes: ['300h'] });

    expect(sources[1]?.srcset).toBe('//images.ctfassets.net/foo.png?fm=webp&w=400&h=300 400w');
  });

  it('uses the width descriptor when both width and height were given', () => {
    const sources = generateContentfulImageSources(createRestAsset(), { srcsetSizes: ['400x300'] });

    expect(sources[1]?.srcset).toBe('//images.ctfassets.net/foo.png?fm=webp&w=400&h=300 400w');
  });

  it('assembles bg, q, f and fit query params in order', () => {
    const sources = generateContentfulImageSources(createRestAsset(), {
      srcsetSizes: ['400w'],
      backgroundColor: '000000',
      quality: 80,
      focusArea: 'faces',
      resizeBehavior: 'fill',
    });

    expect(sources[1]?.srcset).toBe(
      '//images.ctfassets.net/foo.png?fm=webp&bg=rgb:000000&q=80&f=faces&fit=fill&w=400 400w',
    );
  });

  it('includes a quality of 0 (only null is skipped)', () => {
    const sources = generateContentfulImageSources(createRestAsset(), { srcsetSizes: ['400w'], quality: 0 });

    expect(sources[0]?.srcset).toContain('q=0');
  });

  it('falls back to the plain url with query params when no sizes were given', () => {
    const sources = generateContentfulImageSources(createRestAsset());

    expect(sources[1]).toEqual({ type: 'image/webp', srcset: '//images.ctfassets.net/foo.png?fm=webp' });
  });

  it('uses the flat url of a gql asset', () => {
    const sources = generateContentfulImageSources(createGqlAsset(), { srcsetSizes: ['400w'] });

    expect(sources[0]?.srcset).toBe('//images.ctfassets.net/gql.png?fm=avif&w=400 400w');
  });

  it('returns no sources when an asset has no url', () => {
    expect(generateContentfulImageSources(createRestAsset({ url: null }), { srcsetSizes: ['400w'] })).toEqual([]);
    expect(generateContentfulImageSources(createGqlAsset({ url: null }), { srcsetSizes: ['400w'] })).toEqual([]);
  });

  it('does not emit an invalid quality parameter', () => {
    const sources = generateContentfulImageSources(createRestAsset(), { srcsetSizes: ['400w'], quality: Number.NaN });

    expect(sources[0]?.srcset).not.toContain('q=');
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
    expect(generateDefaultContentfulImageSource(createGqlAsset({ contentType: null }))).toEqual({
      type: '',
      srcset: '',
    });
  });

  it('returns an empty source when a gql asset has no url', () => {
    expect(generateDefaultContentfulImageSource(createGqlAsset({ url: null }))).toEqual({ type: '', srcset: '' });
  });
});

describe('an asset without a file for the locale', () => {
  const asset: ContentfulRestAsset = { ...createRestAsset(), fields: { title: 'Title', description: '' } };

  it('yields no sources', () => {
    expect(generateContentfulImageSources(asset, { srcsetSizes: ['400w'] })).toEqual([]);
    expect(generateDefaultContentfulImageSource(asset)).toEqual({ type: '', srcset: '' });
  });
});
