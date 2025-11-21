import { inferMimeType } from './infer-mime-type.pipe';

describe('infer mime type', () => {
  it('should infer', () => {
    expect(
      inferMimeType('https://cdn.the-site-dev.domain.io/media/cache/some_content/default/0001/06/5268-image-n5me.png'),
    ).toBe('image/png');

    expect(
      inferMimeType(
        'https://cdn.site.name/cache/media/img/dc8b0fa6-eff5-4a53-a8ee-713bd93ec509/image_name-dc8b0fa6-eff5-4a53-a8ee-713bd93ec509.png?',
      ),
    ).toBe('image/png');

    expect(inferMimeType('https://some.where.net/abc123/def456/hij789/i-mage.png?fm=avif&w=1024&q=100')).toBe(
      'image/avif',
    );

    expect(inferMimeType('https://some.where.net/abc123/def456/hij789/i-mage.png?w=1024&q=100&fm=avif')).toBe(
      'image/avif',
    );

    expect(inferMimeType('https://www.some.where/assets/folder-name/file_name.jpg')).toBe('image/jpeg');
    expect(inferMimeType('https://some.fifa.where/assets/folder-name/file_name.jpeg')).toBe('image/jpeg');

    expect(
      inferMimeType(
        '//images.assets.net/abc123/def456/hij789/background.png?fm=avif&w=342&q=100 342w,//images.ctfassets.net/8hwv8jdog42r/3zYlUmgws8Zhdh7Q9ZrF6C/5df4d677a9ce1012a516dd7b0d74bf34/background-sharing-fifagg.png?fm=avif&w=512&q=100 512w,//images.ctfassets.net/8hwv8jdog42r/3zYlUmgws8Zhdh7Q9ZrF6C/5df4d677a9ce1012a516dd7b0d74bf34/background-sharing-fifagg.png?fm=avif&w=1024&q=100 1024w,',
      ),
    ).toBe('image/avif');

    expect(
      inferMimeType(
        '/assets/overviews/rocket-league/nations/banner_mobile.webp 1x, /assets/overviews/rocket-league/nations/banner_mobile2x.webp 2x',
      ),
    ).toBe('image/webp');
  });
});
