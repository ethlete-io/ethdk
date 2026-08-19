import { ContentfulRestAsset } from '../types';
import { ContentfulGqlAsset, isContentfulGqlAsset } from './asset.fragments';

const gqlAsset = (overrides: Partial<ContentfulGqlAsset> = {}): ContentfulGqlAsset => ({
  sys: { id: 'asset-1' },
  title: null,
  contentType: null,
  url: null,
  description: null,
  width: null,
  height: null,
  size: null,
  ...overrides,
});

describe('isContentfulGqlAsset', () => {
  it('accepts nullable gql asset fields', () => {
    expect(isContentfulGqlAsset(gqlAsset())).toBe(true);
    expect(isContentfulGqlAsset(gqlAsset({ url: '//cdn/image.png', size: 10 }))).toBe(true);
  });

  it('rejects a rest asset', () => {
    const restAsset = {
      sys: { id: 'asset-1' },
      fields: { file: { url: null } },
    } as ContentfulRestAsset;

    expect(isContentfulGqlAsset(restAsset)).toBe(false);
  });

  it('always returns a boolean', () => {
    expect(isContentfulGqlAsset(null)).toBe(false);
    expect(isContentfulGqlAsset({})).toBe(false);
  });
});
