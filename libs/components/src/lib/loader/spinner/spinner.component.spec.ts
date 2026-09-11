import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../../../test-helpers';
import { SpinnerComponent } from './spinner.component';

// jsdom drops the component stylesheet whole (`@layer`, nesting) and vitest stubs CSS imports to an empty
// string, so the source text is the only place an animation duration is observable from a spec.
const spinnerCss = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'spinner.component.css'), 'utf8');

describe('SpinnerComponent', () => {
  let fixture: ComponentFixture<SpinnerComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SpinnerComponent] });
    fixture = TestBed.createComponent(SpinnerComponent);
    host = fixture.nativeElement;
    fixture.detectChanges();
  });

  describe('host element', () => {
    it('has role="progressbar"', () => {
      expect(host.getAttribute('role')).toBe('progressbar');
    });
  });

  describe('indeterminate mode (default)', () => {
    it('does not expose aria-valuenow', () => {
      expect(host.getAttribute('aria-valuenow')).toBeNull();
    });

    it('does not expose aria-valuemin', () => {
      expect(host.getAttribute('aria-valuemin')).toBeNull();
    });

    it('does not expose aria-valuemax', () => {
      expect(host.getAttribute('aria-valuemax')).toBeNull();
    });

    it('does not have the determinate class', () => {
      expect(host.classList.contains('et-spinner--determinate')).toBe(false);
    });

    it('renders the indeterminate container', () => {
      expect(host.querySelector('.et-spinner-indeterminate-container')).not.toBeNull();
    });

    it('does not render the determinate graphic', () => {
      expect(host.querySelector('.et-spinner-determinate-graphic')).toBeNull();
    });
  });

  describe('determinate mode', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('determinate', true);
      fixture.detectChanges();
    });

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
      fixture.componentRef.setInput('value', 75);
      fixture.detectChanges();
      expect(host.getAttribute('aria-valuenow')).toBe('75');
    });

    it('clamps negative values to 0', () => {
      fixture.componentRef.setInput('value', -5);
      fixture.detectChanges();
      expect(host.getAttribute('aria-valuenow')).toBe('0');
    });

    it('clamps values above 100 to 100', () => {
      fixture.componentRef.setInput('value', 200);
      fixture.detectChanges();
      expect(host.getAttribute('aria-valuenow')).toBe('100');
    });

    it('adds the determinate class', () => {
      expect(host.classList.contains('et-spinner--determinate')).toBe(true);
    });

    it('renders the determinate graphic', () => {
      expect(host.querySelector('.et-spinner-determinate-graphic')).not.toBeNull();
    });

    it('does not render the indeterminate container', () => {
      expect(host.querySelector('.et-spinner-indeterminate-container')).toBeNull();
    });
  });

  describe('track', () => {
    it('does not render the track container by default', () => {
      expect(host.querySelector('.et-spinner-track-container')).toBeNull();
    });

    it('renders the track container when track=true', () => {
      fixture.componentRef.setInput('track', true);
      fixture.detectChanges();
      expect(host.querySelector('.et-spinner-track-container')).not.toBeNull();
    });
  });

  describe('color', () => {
    it('does not add the themed class by default', () => {
      expect(host.classList.contains('et-spinner--themed')).toBe(false);
    });

    it('adds the themed class once a color is set', () => {
      fixture.componentRef.setInput('color', 'brand');
      fixture.detectChanges();
      expect(host.classList.contains('et-spinner--themed')).toBe(true);
    });

    it('does not add the themed class for an explicit null', () => {
      fixture.componentRef.setInput('color', null);
      fixture.detectChanges();
      expect(host.classList.contains('et-spinner--themed')).toBe(false);
    });
  });

  describe('CSS custom properties', () => {
    it('applies the default diameter as a CSS variable', () => {
      expect(host.style.getPropertyValue('--et-spinner-size')).toBe('18px');
    });

    it('applies a custom diameter as a CSS variable', () => {
      fixture.componentRef.setInput('diameter', 48);
      fixture.detectChanges();
      expect(host.style.getPropertyValue('--et-spinner-size')).toBe('48px');
    });
  });
});

describe('SpinnerComponent styles', () => {
  it('lets the duration token reach the animated descendants', () => {
    const rule = /@property --et-spinner-duration \{([^}]*)\}/.exec(spinnerCss)?.[1];

    expect(rule).toContain('inherits: true');
  });

  it('times the sweep from the duration token', () => {
    expect(spinnerCss).toContain('animation: et-spinner-left-spin var(--et-spinner-duration)');
    expect(spinnerCss).toContain('animation: et-spinner-right-spin var(--et-spinner-duration)');
  });

  it('keeps the container rotation at 1568/1333 of the duration token', () => {
    expect(spinnerCss).toContain('animation: et-spinner-rotate calc(var(--et-spinner-duration) * 1568 / 1333)');
  });

  it('keeps the layer rotation at four times the duration token', () => {
    expect(spinnerCss).toContain('animation: et-spinner-layer-rotate calc(var(--et-spinner-duration) * 4)');
  });

  it('hardcodes no animation duration', () => {
    const durations = [...spinnerCss.matchAll(/animation: \S+ (\S+)/g)].map(([, duration]) => duration ?? '');

    expect(durations).not.toHaveLength(0);
    expect(durations.filter((duration) => /^[\d.]+m?s$/.test(duration))).toEqual([]);
  });
});
