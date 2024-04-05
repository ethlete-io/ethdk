import { normalizePictureSizes, normalizePictureSource } from './picture.utils';

describe('normalizePictureSource', () => {
  it('should return PictureSource Object with type and srcset when input a string', () => {
    expect(normalizePictureSource('test-asset.png')).toEqual({ type: 'image/png', srcset: 'test-asset.png' });
  });

  it('should return PictureSource Object with type and srcset when input a PictureObject', () => {
    expect(normalizePictureSource({ type: '', srcset: 'test-asset.jpg' })).toEqual({
      type: 'image/jpeg',
      srcset: 'test-asset.jpg',
    });
  });

  it('should return PictureSource Object with type and srcset when input a PictureObject', () => {
    expect(normalizePictureSource({ type: 'image/png', srcset: 'test-asset.jpg' })).toEqual({
      type: 'image/png',
      srcset: 'test-asset.jpg',
    });
  });

  it('should return PictureSource Object with type === null and srcset when input string with unknown extension', () => {
    expect(normalizePictureSource('test-asset.banana')).toEqual({ type: null, srcset: 'test-asset.banana' });
  });

  it('should return PictureSource Object with type === null and srcset when input string with no extension', () => {
    expect(normalizePictureSource('test-asset')).toEqual({ type: null, srcset: 'test-asset' });
  });

  it('should return PictureSource Object with type === null and srcset when input PictureSource with type: null and no real extension', () => {
    expect(normalizePictureSource({ type: null, srcset: 'asset/one.banana' })).toEqual({
      type: null,
      srcset: 'asset/one.banana',
    });
  });
});

describe('normalizePictureSizes', () => {
  it('should return null when input is null', () => {
    expect(normalizePictureSizes(null)).toBeNull();
  });

  it('should return a sizes string when input is an array', () => {
    expect(normalizePictureSizes(['(max-width: 600px) 100vw', '50vw'])).toEqual('(max-width: 600px) 100vw, 50vw');
  });

  it('should return a sizes string when input is a string', () => {
    expect(normalizePictureSizes('(max-width: 600px) 100vw, 50vw')).toEqual('(max-width: 600px) 100vw, 50vw');
  });
});
