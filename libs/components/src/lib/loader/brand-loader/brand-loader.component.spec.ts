import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { BrandLoaderComponent } from './brand-loader.component';

describe('BrandLoaderComponent', () => {
  let fixture: ComponentFixture<BrandLoaderComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BrandLoaderComponent] });
    fixture = TestBed.createComponent(BrandLoaderComponent);
    host = fixture.nativeElement;
    fixture.detectChanges();
  });

  describe('host element', () => {
    it('has role="progressbar"', () => {
      expect(host.getAttribute('role')).toBe('progressbar');
    });

    it('has aria-label="Loading"', () => {
      expect(host.getAttribute('aria-label')).toBe('Loading');
    });
  });

  describe('SVG structure', () => {
    it('renders an SVG element', () => {
      expect(host.querySelector('svg')).not.toBeNull();
    });

    it('marks the inner SVG as aria-hidden', () => {
      expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('clip path IDs', () => {
    it('generates a shape clip path with a unique ID', () => {
      const fixture2 = TestBed.createComponent(BrandLoaderComponent);
      fixture2.detectChanges();

      const id1 = fixture.componentInstance.SHAPE_CLIP_ID;
      const id2 = fixture2.componentInstance.SHAPE_CLIP_ID;

      expect(id1).not.toBe(id2);
    });

    it('generates a fill clip path with a unique ID', () => {
      const fixture2 = TestBed.createComponent(BrandLoaderComponent);
      fixture2.detectChanges();

      const id1 = fixture.componentInstance.FILL_CLIP_ID;
      const id2 = fixture2.componentInstance.FILL_CLIP_ID;

      expect(id1).not.toBe(id2);
    });

    it('the shape clip reference matches the shape clip path ID', () => {
      const { SHAPE_CLIP_ID, shapeClip } = fixture.componentInstance;
      expect(shapeClip).toBe(`url(#${SHAPE_CLIP_ID})`);
    });

    it('the fill clip reference matches the fill clip path ID', () => {
      const { FILL_CLIP_ID, fillClip } = fixture.componentInstance;
      expect(fillClip).toBe(`url(#${FILL_CLIP_ID})`);
    });
  });
});
