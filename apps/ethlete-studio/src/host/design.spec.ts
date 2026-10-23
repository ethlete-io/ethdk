import { frameUrl } from './design';

describe('frameUrl', () => {
  it('encodes the slug and the variant', () => {
    expect(frameUrl({ port: 4300, slug: 'shop/a b', variant: 'x&y' })).toBe(
      'http://localhost:4300/frame.html?call=shop%2Fa%20b&variant=x%26y',
    );
  });

  it('appends a non-zero epoch only', () => {
    expect(frameUrl({ port: 1, slug: 's', variant: 'v', epoch: 0 })).not.toContain('epoch');
    expect(frameUrl({ port: 1, slug: 's', variant: 'v', epoch: 2 })).toMatch(/&epoch=2$/);
  });

  it('appends the surface and the colour it is given', () => {
    expect(frameUrl({ port: 1, slug: 's', variant: 'v', surface: 'dark', color: 'a b' })).toBe(
      'http://localhost:1/frame.html?call=s&variant=v&surface=dark&color=a%20b',
    );
    expect(frameUrl({ port: 1, slug: 's', variant: 'v', color: 'brand' })).toBe(
      'http://localhost:1/frame.html?call=s&variant=v&color=brand',
    );
  });
});
