import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PictureComponent } from './picture.component';

describe('PictureComponent', () => {
  let fixture: ComponentFixture<PictureComponent>;
  let picture: PictureComponent;
  let loads: { naturalWidth: number; naturalHeight: number }[];

  const getHostEl = () => fixture.nativeElement as HTMLElement;
  const getImgEl = () => getHostEl().querySelector('img.et-picture-img') as HTMLImageElement;

  const fireLoad = (naturalWidth: number, naturalHeight: number) => {
    const img = getImgEl();

    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: naturalWidth });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: naturalHeight });

    img.dispatchEvent(new Event('load'));
    fixture.detectChanges();
  };

  const fireError = () => {
    getImgEl().dispatchEvent(new Event('error'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PictureComponent] });

    fixture = TestBed.createComponent(PictureComponent);
    picture = fixture.componentInstance;
    loads = [];

    picture.imgLoad.subscribe((event) => loads.push(event));

    fixture.componentRef.setInput('alt', 'A test');
    fixture.componentRef.setInput('defaultSrc', 'first.jpg');
    fixture.detectChanges();
  });

  describe('fit', () => {
    it('omits data-fit and the fit custom property by default', () => {
      expect(getHostEl().hasAttribute('data-fit')).toBe(false);
      expect(getHostEl().style.getPropertyValue('--_et-picture-fit')).toBe('');
    });

    it('reflects fit as data-fit and as the custom property the stylesheet reads', () => {
      fixture.componentRef.setInput('fit', 'cover');
      fixture.detectChanges();

      expect(getHostEl().getAttribute('data-fit')).toBe('cover');
      expect(getHostEl().style.getPropertyValue('--_et-picture-fit')).toBe('cover');
    });

    it('drops both again when fit goes back to null', () => {
      fixture.componentRef.setInput('fit', 'contain');
      fixture.detectChanges();
      fixture.componentRef.setInput('fit', null);
      fixture.detectChanges();

      expect(getHostEl().hasAttribute('data-fit')).toBe(false);
      expect(getHostEl().style.getPropertyValue('--_et-picture-fit')).toBe('');
    });
  });

  describe('reserved aspect ratio', () => {
    it('is absent without aspectRatio', () => {
      expect(getHostEl().hasAttribute('data-aspect-ratio')).toBe(false);
      expect(getHostEl().style.getPropertyValue('--_et-picture-aspect-ratio')).toBe('');
    });

    it('is on the host while no img exists yet', () => {
      fixture.componentRef.setInput('defaultSrc', null);
      fixture.componentRef.setInput('aspectRatio', '16 / 9');
      fixture.detectChanges();

      expect(getImgEl()).toBeNull();
      expect(getHostEl().getAttribute('data-aspect-ratio')).toBe('16 / 9');
      expect(getHostEl().style.getPropertyValue('--_et-picture-aspect-ratio')).toBe('16 / 9');
    });

    it('is left to the img when a width sizes it', () => {
      fixture.componentRef.setInput('aspectRatio', 4 / 3);
      fixture.componentRef.setInput('width', 400);
      fixture.detectChanges();

      expect(getHostEl().hasAttribute('data-aspect-ratio')).toBe(false);
      expect(getImgEl().style.aspectRatio).not.toBe('');
    });
  });

  describe('natural size', () => {
    it('is null while loading', () => {
      expect(picture.naturalSize()).toBeNull();
      expect(picture.naturalAspectRatio()).toBeNull();
    });

    it('is set from the decoded image on load, and emitted with imgLoad', () => {
      fireLoad(800, 400);

      expect(loads).toEqual([{ naturalWidth: 800, naturalHeight: 400 }]);
      expect(picture.naturalSize()).toEqual({ width: 800, height: 400 });
      expect(picture.naturalAspectRatio()).toBe(2);
      expect(picture.state()).toBe('loaded');
    });

    it('is null after a failure', () => {
      fireLoad(800, 400);
      fireError();

      expect(picture.naturalSize()).toBeNull();
      expect(picture.naturalAspectRatio()).toBeNull();
      expect(picture.state()).toBe('error');
    });

    it('resets when defaultSrc changes', () => {
      fireLoad(800, 400);

      fixture.componentRef.setInput('defaultSrc', 'second.jpg');
      fixture.detectChanges();

      expect(picture.naturalSize()).toBeNull();
      expect(picture.naturalAspectRatio()).toBeNull();
      expect(picture.state()).toBe('loading');
    });

    it('resets when only sources change', () => {
      fireLoad(800, 400);

      fixture.componentRef.setInput('sources', [{ srcset: 'wide.avif', media: '(min-width: 700px)' }]);
      fixture.detectChanges();

      expect(picture.naturalSize()).toBeNull();
      expect(picture.state()).toBe('loading');
    });
  });

  it('reports an error instead of loading forever when sources are set without defaultSrc', () => {
    fixture.componentRef.setInput('defaultSrc', null);
    fixture.componentRef.setInput('sources', ['wide.avif']);
    fixture.detectChanges();

    expect(getImgEl()).toBeNull();
    expect(picture.state()).toBe('error');
  });
});
