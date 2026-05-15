import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { BUTTON_ICON_ALIGNMENTS, BUTTON_SIZES } from './button.component';
import { TextButtonComponent } from './text-button.component';

describe('TextButtonComponent', () => {
  let fixture: ComponentFixture<TextButtonComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TextButtonComponent] });
    fixture = TestBed.createComponent(TextButtonComponent);
    host = fixture.nativeElement;
  });

  it('has the et-text-button class', () => {
    fixture.detectChanges();
    expect(host.classList.contains('et-text-button')).toBe(true);
  });

  describe('size', () => {
    it('defaults to data-size="md"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('md');
    });

    it('reflects sm size in data-size', () => {
      fixture.componentRef.setInput('size', BUTTON_SIZES.SM);
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('sm');
    });

    it('reflects xs size in data-size', () => {
      fixture.componentRef.setInput('size', BUTTON_SIZES.XS);
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('xs');
    });
  });

  describe('icon alignment', () => {
    it('defaults to data-icon-alignment="start"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-icon-alignment')).toBe('start');
    });

    it('reflects end alignment in data-icon-alignment', () => {
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

  it('renders the content wrapper', () => {
    fixture.detectChanges();
    expect(host.querySelector('.et-text-button-contents')).not.toBeNull();
  });
});
