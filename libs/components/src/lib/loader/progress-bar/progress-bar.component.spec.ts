import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { provideLoaderLabels } from '../loader-labels';
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
  });

  describe('indeterminate mode (value unbound)', () => {
    it('does not expose aria-valuenow', () => {
      expect(host.getAttribute('aria-valuenow')).toBeNull();
    });

    it('does not expose aria-valuemin', () => {
      expect(host.getAttribute('aria-valuemin')).toBeNull();
    });

    it('does not expose aria-valuemax', () => {
      expect(host.getAttribute('aria-valuemax')).toBeNull();
    });

    it('adds the indeterminate class', () => {
      expect(host.classList.contains('et-progress-bar--indeterminate')).toBe(true);
    });
  });

  describe('determinate mode (value bound)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('value', 0);
      fixture.detectChanges();
    });

    it('exposes a bound 0 as aria-valuenow', () => {
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

    it('falls back to 0 for a non-numeric value', () => {
      fixture.componentRef.setInput('value', 'abc');
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

    it.each([null, undefined])('turns indeterminate again when value is set to %s', (value) => {
      fixture.componentRef.setInput('value', value);
      fixture.detectChanges();

      expect(host.getAttribute('aria-valuenow')).toBeNull();
      expect(host.classList.contains('et-progress-bar--indeterminate')).toBe(true);
    });
  });

  describe('color', () => {
    it('does not add the themed class by default', () => {
      expect(host.classList.contains('et-progress-bar--themed')).toBe(false);
    });

    it('adds the themed class once a color is set', () => {
      fixture.componentRef.setInput('color', 'brand');
      fixture.detectChanges();
      expect(host.classList.contains('et-progress-bar--themed')).toBe(true);
    });

    it('does not add the themed class for an explicit null', () => {
      fixture.componentRef.setInput('color', null);
      fixture.detectChanges();
      expect(host.classList.contains('et-progress-bar--themed')).toBe(false);
    });
  });
});

describe('ProgressBarComponent accessible name', () => {
  @Component({
    template: `<et-progress-bar aria-label="Uploading" />`,
    imports: [ProgressBarComponent],
  })
  class NamedHost {}

  it('defaults to the loader loading label', () => {
    const fixture = TestBed.createComponent(ProgressBarComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Loading');
  });

  it('follows the provided loader labels', () => {
    TestBed.configureTestingModule({ providers: [provideLoaderLabels({ loading: 'Lädt' })] });

    const fixture = TestBed.createComponent(ProgressBarComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Lädt');
  });

  it('keeps an aria-label the consumer sets', () => {
    const fixture = TestBed.createComponent(NamedHost);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('et-progress-bar').getAttribute('aria-label')).toBe('Uploading');
  });
});
