import { normalizeSource } from './normalize-source.util';

describe('normalizedSource', () => {
  it('should return PictureSource Object with type and srcset when input a string', () => {
    expect(normalizeSource('test-asset.png')).toEqual({ type: 'image/png', srcset: 'test-asset.png' });
  });

  it('should return PictureSource Object with type and srcset when input a PictureObject', () => {
    expect(normalizeSource({ type: '', srcset: 'test-asset.jpg' })).toEqual({
      type: 'image/jpeg',
      srcset: 'test-asset.jpg',
    });
  });

  it('should return PictureSource Object with type and srcset when input a PictureObject', () => {
    expect(normalizeSource({ type: 'image/png', srcset: 'test-asset.jpg' })).toEqual({
      type: 'image/png',
      srcset: 'test-asset.jpg',
    });
  });

  it('should return PictureSource Object with type === null and srcset when input string with unknown extension', () => {
    expect(normalizeSource('test-asset.banana')).toEqual({ type: null, srcset: 'test-asset.banana' });
  });

  it('should return PictureSource Object with type === null and srcset when input string with no extension', () => {
    expect(normalizeSource('test-asset')).toEqual({ type: null, srcset: 'test-asset' });
  });

  it('should return PictureSource Object with type === null and srcset when input PictureSource with type: null and no real extension', () => {
    expect(normalizeSource({ type: null, srcset: 'asset/one.banana' })).toEqual({
      type: null,
      srcset: 'asset/one.banana',
    });
  });
});
