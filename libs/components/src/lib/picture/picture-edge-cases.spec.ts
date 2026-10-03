import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PictureComponent } from './picture.component';
import { extractFirstImageUrl, withPictureBaseUrl } from './picture.utils';

describe('PictureComponent with missing sources', () => {
  let fixture: ComponentFixture<PictureComponent>;
  let picture: PictureComponent;

  const getImgEl = () => (fixture.nativeElement as HTMLElement).querySelector('img');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PictureComponent] });

    fixture = TestBed.createComponent(PictureComponent);
    picture = fixture.componentInstance;
    fixture.componentRef.setInput('alt', '');
  });

  it('renders neither an img nor a source while nothing is given, and waits as a pending load', () => {
    fixture.detectChanges();

    expect(getImgEl()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('source')).toBeNull();
    expect(picture.state()).toBe('loading');
    expect(picture.naturalSize()).toBeNull();
  });

  it('treats an empty defaultSrc string like a missing one', () => {
    fixture.componentRef.setInput('defaultSrc', '');
    fixture.detectChanges();

    expect(getImgEl()).toBeNull();
  });

  it('recovers from the missing-defaultSrc error once a defaultSrc arrives', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    fixture.componentRef.setInput('sources', ['wide.avif']);
    fixture.detectChanges();

    expect(picture.state()).toBe('error');

    fixture.componentRef.setInput('defaultSrc', 'fallback.jpg');
    fixture.detectChanges();

    expect(picture.state()).toBe('loading');
    expect(getImgEl()?.getAttribute('src')).toBe('fallback.jpg');
  });

  it('starts loading again after a failure once defaultSrc goes away and comes back', () => {
    fixture.componentRef.setInput('defaultSrc', 'broken.jpg');
    fixture.detectChanges();
    getImgEl()?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(picture.state()).toBe('error');

    fixture.componentRef.setInput('defaultSrc', null);
    fixture.detectChanges();
    fixture.componentRef.setInput('defaultSrc', 'broken.jpg');
    fixture.detectChanges();

    expect(picture.state()).toBe('loading');
  });
});

describe('PictureComponent with unset dimensions', () => {
  it('treats a width and height bound to null as unset', () => {
    TestBed.configureTestingModule({ imports: [PictureComponent] });

    const fixture = TestBed.createComponent(PictureComponent);
    fixture.componentRef.setInput('alt', '');
    fixture.componentRef.setInput('defaultSrc', 'hero.jpg');
    fixture.componentRef.setInput('aspectRatio', '16 / 9');
    fixture.componentRef.setInput('width', null);
    fixture.componentRef.setInput('height', null);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const img = host.querySelector('img');

    expect(fixture.componentInstance.width()).toBeNull();
    expect(fixture.componentInstance.height()).toBeNull();
    expect(img?.hasAttribute('width')).toBe(false);
    expect(img?.hasAttribute('height')).toBe(false);
    expect(host.getAttribute('data-aspect-ratio')).toBe('16 / 9');
  });

  it('treats a width that is not a number as unset', () => {
    TestBed.configureTestingModule({ imports: [PictureComponent] });

    const fixture = TestBed.createComponent(PictureComponent);
    fixture.componentRef.setInput('alt', '');
    fixture.componentRef.setInput('defaultSrc', 'hero.jpg');
    fixture.componentRef.setInput('width', 'auto');
    fixture.detectChanges();

    expect(fixture.componentInstance.width()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.hasAttribute('width')).toBe(false);
  });
});

describe('picture utils with missing sources', () => {
  it('extracts nothing from an empty or whitespace srcset', () => {
    expect(extractFirstImageUrl('')).toBeNull();
    expect(extractFirstImageUrl('   ')).toBeNull();
    expect(extractFirstImageUrl({ srcset: '', type: null, media: null, sizes: null })).toBeNull();
    expect(extractFirstImageUrl(null)).toBeNull();
  });

  it('leaves an empty srcset empty when applying a base URL', () => {
    expect(withPictureBaseUrl({ srcset: '', type: null, media: null, sizes: null }, { baseUrl: '/cdn' }).srcset).toBe(
      '',
    );
  });

  it('keeps a comma inside a candidate url', () => {
    const srcset = 'img.jpg?rect=0,0,100,100 1x, img@2x.jpg 2x';

    expect(extractFirstImageUrl(srcset)).toBe('img.jpg?rect=0,0,100,100');
    expect(withPictureBaseUrl({ srcset, type: null, media: null, sizes: null }, { baseUrl: '/cdn' }).srcset).toBe(
      '/cdn/img.jpg?rect=0,0,100,100 1x, /cdn/img@2x.jpg 2x',
    );
  });

  it('splits candidates separated by a comma without a space after a descriptor', () => {
    expect(
      withPictureBaseUrl({ srcset: 'a.jpg 1x,b.jpg 2x', type: null, media: null, sizes: null }, { baseUrl: '/cdn' })
        .srcset,
    ).toBe('/cdn/a.jpg 1x, /cdn/b.jpg 2x');
  });
});
