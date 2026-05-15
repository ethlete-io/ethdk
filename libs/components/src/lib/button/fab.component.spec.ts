import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { BUTTON_ICON_ALIGNMENTS, BUTTON_SIZES, BUTTON_VARIANTS } from './button.component';
import { FabComponent } from './fab.component';

describe('FabComponent', () => {
  let fixture: ComponentFixture<FabComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FabComponent] });
    fixture = TestBed.createComponent(FabComponent);
    host = fixture.nativeElement;
  });

  it('has the et-fab class', () => {
    fixture.detectChanges();
    expect(host.classList.contains('et-fab')).toBe(true);
  });

  describe('variant', () => {
    it('defaults to data-variant="filled"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-variant')).toBe('filled');
    });

    it('reflects custom variant in data-variant', () => {
      fixture.componentRef.setInput('variant', BUTTON_VARIANTS.TONAL);
      fixture.detectChanges();
      expect(host.getAttribute('data-variant')).toBe('tonal');
    });
  });

  describe('size', () => {
    it('defaults to data-size="md"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('md');
    });

    it('reflects custom size in data-size', () => {
      fixture.componentRef.setInput('size', BUTTON_SIZES.XL);
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('xl');
    });
  });

  describe('expanded', () => {
    it('has no data-expanded by default', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-expanded')).toBeNull();
    });

    it('sets data-expanded when expanded is true', () => {
      fixture.componentRef.setInput('expanded', true);
      fixture.detectChanges();
      expect(host.getAttribute('data-expanded')).toBe('true');
    });
  });

  describe('icon alignment', () => {
    it('defaults to data-icon-alignment="start"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-icon-alignment')).toBe('start');
    });

    it('reflects custom alignment in data-icon-alignment', () => {
      fixture.componentRef.setInput('iconAlignment', BUTTON_ICON_ALIGNMENTS.END);
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
});
