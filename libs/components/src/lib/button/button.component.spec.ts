import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { BUTTON_SIZES, BUTTON_VARIANTS, ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ButtonComponent] });
    fixture = TestBed.createComponent(ButtonComponent);
    host = fixture.nativeElement;
  });

  describe('variant', () => {
    it('defaults to data-variant="filled"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-variant')).toBe('filled');
    });

    it('reflects custom variant in data-variant', () => {
      fixture.componentRef.setInput('variant', BUTTON_VARIANTS.OUTLINE);
      fixture.detectChanges();
      expect(host.getAttribute('data-variant')).toBe('outline');
    });
  });

  describe('size', () => {
    it('defaults to data-size="md"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('md');
    });

    it('reflects custom size in data-size', () => {
      fixture.componentRef.setInput('size', BUTTON_SIZES.LG);
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('lg');
    });
  });

  describe('icon alignment', () => {
    it('defaults to data-icon-alignment="start"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-icon-alignment')).toBe('start');
    });

    it('reflects custom alignment in data-icon-alignment', () => {
      fixture.componentRef.setInput('iconAlignment', 'end');
      fixture.detectChanges();
      expect(host.getAttribute('data-icon-alignment')).toBe('end');
    });
  });

  describe('loading state', () => {
    it('does not render the spinner by default', () => {
      fixture.detectChanges();
      expect(host.querySelector('et-spinner')).toBeNull();
    });

    it('renders the spinner when loading', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      expect(host.querySelector('et-spinner')).not.toBeNull();
    });
  });

  describe('pressed variant', () => {
    it('has no data-pressed-variant when not pressed', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-pressed-variant')).toBeNull();
    });

    it('maps filled to outline when pressed', () => {
      fixture.componentRef.setInput('variant', BUTTON_VARIANTS.FILLED);
      fixture.componentRef.setInput('pressed', true);
      fixture.detectChanges();
      expect(host.getAttribute('data-pressed-variant')).toBe('outline');
    });

    it('maps outline to filled when pressed', () => {
      fixture.componentRef.setInput('variant', BUTTON_VARIANTS.OUTLINE);
      fixture.componentRef.setInput('pressed', true);
      fixture.detectChanges();
      expect(host.getAttribute('data-pressed-variant')).toBe('filled');
    });

    it('maps tonal to filled when pressed', () => {
      fixture.componentRef.setInput('variant', BUTTON_VARIANTS.TONAL);
      fixture.componentRef.setInput('pressed', true);
      fixture.detectChanges();
      expect(host.getAttribute('data-pressed-variant')).toBe('filled');
    });

    it('maps transparent to tonal when pressed', () => {
      fixture.componentRef.setInput('variant', BUTTON_VARIANTS.TRANSPARENT);
      fixture.componentRef.setInput('pressed', true);
      fixture.detectChanges();
      expect(host.getAttribute('data-pressed-variant')).toBe('tonal');
    });
  });
});
