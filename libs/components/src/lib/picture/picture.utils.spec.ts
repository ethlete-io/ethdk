import {
  extractFirstImageUrl,
  normalizePictureSizes,
  normalizePictureSource,
  withPictureBaseUrl,
} from './picture.utils';

describe('extractFirstImageUrl', () => {
  const expectedUrl = 'https://example.com/image1.jpg';
  const unexpectedUrl = 'https://example.com/image2.jpg';

  it('works with strings', () => {
    expect(extractFirstImageUrl(expectedUrl)).toEqual(expectedUrl);
    expect(extractFirstImageUrl(`${expectedUrl} 1x, ${unexpectedUrl} 2x`)).toEqual(expectedUrl);
    expect(extractFirstImageUrl(`${expectedUrl} 300w, ${unexpectedUrl} 600w`)).toEqual(expectedUrl);
    expect(extractFirstImageUrl(`   ${expectedUrl}   `)).toEqual(expectedUrl);
    expect(extractFirstImageUrl(`${unexpectedUrl} 300w, ${expectedUrl} 600w`)).not.toBe(expectedUrl);
  });

  it('works with a PictureSource', () => {
    expect(extractFirstImageUrl({ srcset: expectedUrl })).toEqual(expectedUrl);
    expect(extractFirstImageUrl({ srcset: `${expectedUrl} 1x, ${unexpectedUrl} 2x` })).toEqual(expectedUrl);
    expect(extractFirstImageUrl({ srcset: `${expectedUrl} 300w, ${unexpectedUrl} 600w` })).toEqual(expectedUrl);
    expect(extractFirstImageUrl({ srcset: `   ${expectedUrl}   ` })).toEqual(expectedUrl);
  });

  it('returns null for input with no URL in it', () => {
    expect(extractFirstImageUrl(null)).toBeNull();
    expect(extractFirstImageUrl('')).toBeNull();
    expect(extractFirstImageUrl('   ')).toBeNull();
    expect(extractFirstImageUrl({ srcset: '' })).toBeNull();
    expect(extractFirstImageUrl({ srcset: '   ' })).toBeNull();
  });

  it('returns a data URI whole rather than splitting on its commas', () => {
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgAB';

    expect(extractFirstImageUrl(dataUri)).toEqual(dataUri);
    expect(extractFirstImageUrl({ srcset: dataUri })).toEqual(dataUri);
  });
});

describe('normalizePictureSource', () => {
  it('expands a plain string into a full source', () => {
    expect(normalizePictureSource('https://example.com/a.webp')).toEqual({
      type: 'image/webp',
      srcset: 'https://example.com/a.webp',
      media: null,
      sizes: null,
    });
  });

  it('infers a missing mime type and keeps an explicit one', () => {
    expect(normalizePictureSource({ srcset: 'https://example.com/a.png' }).type).toBe('image/png');
    expect(normalizePictureSource({ srcset: 'https://example.com/a.png', type: 'image/avif' }).type).toBe('image/avif');
  });

  it('keeps media and sizes, defaulting them to null', () => {
    expect(normalizePictureSource({ srcset: 'a.jpg', media: '(min-width: 800px)', sizes: '50vw' })).toMatchObject({
      media: '(min-width: 800px)',
      sizes: '50vw',
    });
    expect(normalizePictureSource({ srcset: 'a.jpg' })).toMatchObject({ media: null, sizes: null });
  });
});

describe('normalizePictureSizes', () => {
  it('joins an array into the attribute form', () => {
    expect(normalizePictureSizes(['(min-width: 800px) 50vw', '100vw'])).toBe('(min-width: 800px) 50vw, 100vw');
  });

  it('passes a string through and treats empty input as absent', () => {
    expect(normalizePictureSizes('100vw')).toBe('100vw');
    expect(normalizePictureSizes(null)).toBeNull();
    expect(normalizePictureSizes(undefined)).toBeNull();
    expect(normalizePictureSizes([])).toBeNull();
  });
});

describe('withPictureBaseUrl', () => {
  const source = (srcset: string) => ({ srcset, type: null, media: null, sizes: null });

  it('prefixes a relative srcset', () => {
    expect(withPictureBaseUrl(source('media/a.jpg'), { baseUrl: 'https://cdn.example.com' }).srcset).toBe(
      'https://cdn.example.com/media/a.jpg',
    );
  });

  it('does not double up the separating slash', () => {
    expect(withPictureBaseUrl(source('/media/a.jpg'), { baseUrl: 'https://cdn.example.com/' }).srcset).toBe(
      'https://cdn.example.com/media/a.jpg',
    );
    expect(withPictureBaseUrl(source('media/a.jpg'), { baseUrl: 'https://cdn.example.com/' }).srcset).toBe(
      'https://cdn.example.com/media/a.jpg',
    );
  });

  it('prefixes every candidate of a multi-candidate srcset, keeping the descriptors', () => {
    expect(withPictureBaseUrl(source('a.jpg 400w, b.jpg 800w'), { baseUrl: 'https://cdn.example.com' }).srcset).toBe(
      'https://cdn.example.com/a.jpg 400w, https://cdn.example.com/b.jpg 800w',
    );
  });

  it('leaves absolute URLs and data URIs alone', () => {
    const config = { baseUrl: 'https://cdn.example.com' };

    expect(withPictureBaseUrl(source('https://other.example.com/a.jpg'), config).srcset).toBe(
      'https://other.example.com/a.jpg',
    );
    expect(withPictureBaseUrl(source('data:image/jpeg;base64,abc,def'), config).srcset).toBe(
      'data:image/jpeg;base64,abc,def',
    );
  });

  it('leaves the source untouched without a configured base URL', () => {
    expect(withPictureBaseUrl(source('media/a.jpg'), null).srcset).toBe('media/a.jpg');
    expect(withPictureBaseUrl(source('media/a.jpg'), {}).srcset).toBe('media/a.jpg');
  });

  it('mixes absolute and relative candidates in one srcset', () => {
    expect(
      withPictureBaseUrl(source('a.jpg 1x, https://other.example.com/b.jpg 2x'), {
        baseUrl: 'https://cdn.example.com',
      }).srcset,
    ).toBe('https://cdn.example.com/a.jpg 1x, https://other.example.com/b.jpg 2x');
  });
});
