import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { ProgressBarComponent } from './progress-bar.component';

describe('ProgressBarComponent', () => {
  let fixture: ComponentFixture<ProgressBarComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProgressBarComponent] });
    fixture = TestBed.createComponent(ProgressBarComponent);
    host = fixture.nativeElement;
    fixture.detectChanges();
  });

  describe('host element', () => {
    it('has role="progressbar"', () => {
      expect(host.getAttribute('role')).toBe('progressbar');
    });

    it('has the et-progress-bar class', () => {
      expect(host.classList.contains('et-progress-bar')).toBe(true);
    });
  });

  describe('determinate mode (default)', () => {
    it('exposes aria-valuenow defaulting to 0', () => {
      expect(host.getAttribute('aria-valuenow')).toBe('0');
    });

    it('exposes aria-valuemin of 0', () => {
      expect(host.getAttribute('aria-valuemin')).toBe('0');
    });

    it('exposes aria-valuemax of 100', () => {
      expect(host.getAttribute('aria-valuemax')).toBe('100');
    });

    it('reflects a given value in aria-valuenow', () => {
      fixture.componentRef.setInput('value', 42);
      fixture.detectChanges();
      expect(host.getAttribute('aria-valuenow')).toBe('42');
    });

    it('clamps negative values to 0', () => {
      fixture.componentRef.setInput('value', -10);
      fixture.detectChanges();
      expect(host.getAttribute('aria-valuenow')).toBe('0');
    });

    it('clamps values above 100 to 100', () => {
      fixture.componentRef.setInput('value', 150);
      fixture.detectChanges();
      expect(host.getAttribute('aria-valuenow')).toBe('100');
    });

    it('does not have the indeterminate class', () => {
      expect(host.classList.contains('et-progress-bar--indeterminate')).toBe(false);
    });
  });

  describe('indeterminate mode', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('indeterminate', true);
      fixture.detectChanges();
    });

    it('removes aria-valuenow', () => {
      expect(host.getAttribute('aria-valuenow')).toBeNull();
    });

    it('removes aria-valuemin', () => {
      expect(host.getAttribute('aria-valuemin')).toBeNull();
    });

    it('removes aria-valuemax', () => {
      expect(host.getAttribute('aria-valuemax')).toBeNull();
    });

    it('adds the indeterminate class', () => {
      expect(host.classList.contains('et-progress-bar--indeterminate')).toBe(true);
    });
  });
});
