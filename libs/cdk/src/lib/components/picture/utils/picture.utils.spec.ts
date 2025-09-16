import { extractFirstImageUrl } from './picture.utils';

describe('extractFirstImageUrl', () => {
  const expectedUrl = 'https://example.com/image1.jpg';
  const unexpectedUrl = 'https://example.com/image2.jpg';

  it('should work with strings', () => {
    expect(extractFirstImageUrl(expectedUrl)).toEqual(expectedUrl);
    expect(extractFirstImageUrl(`${expectedUrl} 1x, ${unexpectedUrl} 2x`)).toEqual(expectedUrl);
    expect(extractFirstImageUrl(`${expectedUrl} 300w, ${unexpectedUrl} 600w`)).toEqual(expectedUrl);
    expect(extractFirstImageUrl(`   ${expectedUrl}   `)).toEqual(expectedUrl);
    expect(extractFirstImageUrl(`${unexpectedUrl} 300w, ${expectedUrl} 600w`)).not.toBe(expectedUrl);
  });

  it('should work with PictureSource', () => {
    expect(extractFirstImageUrl({ srcset: expectedUrl })).toEqual(expectedUrl);
    expect(extractFirstImageUrl({ srcset: `${expectedUrl} 1x, ${unexpectedUrl} 2x` })).toEqual(expectedUrl);
    expect(extractFirstImageUrl({ srcset: `${expectedUrl} 300w, ${unexpectedUrl} 600w` })).toEqual(expectedUrl);
    expect(extractFirstImageUrl({ srcset: `   ${expectedUrl}   ` })).toEqual(expectedUrl);
    expect(extractFirstImageUrl({ srcset: `${unexpectedUrl} 300w, ${expectedUrl} 600w` })).not.toBe(expectedUrl);
  });

  it('should return null for invalid input', () => {
    expect(extractFirstImageUrl(null)).toBeNull();
    expect(extractFirstImageUrl('')).toBeNull();
    expect(extractFirstImageUrl('   ')).toBeNull();
    expect(extractFirstImageUrl({} as any)).toBeNull();
    expect(extractFirstImageUrl({ srcset: '' })).toBeNull();
    expect(extractFirstImageUrl({ srcset: '   ' })).toBeNull();
  });
});
