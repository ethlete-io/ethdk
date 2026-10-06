import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, injectLocale, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  BrandLoaderComponent,
  DEFAULT_LOADER_LABELS,
  injectLoaderLabels,
  LOADER_IMPORTS,
  LOADER_LABELS,
  provideLoaderLabels,
  ProgressBarComponent,
  SpinnerComponent,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'accent', primary: swatch('200 120 0') },
];

const query = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

const ariaValues = (element: Element) =>
  ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'].map((name) => element.getAttribute(name));

@Component({
  selector: 'et-scenario-upload-progress',
  imports: [ProgressBarComponent, SpinnerComponent],
  template: `
    <et-progress-bar [value]="uploaded()" [color]="color()" aria-label="Upload team-a roster" />
    <et-spinner
      [value]="uploaded()"
      [diameter]="48"
      [strokeWidth]="4"
      [color]="color()"
      track
      aria-label="Upload progress"
    />
    <button type="button">
      <et-spinner class="inline" />
      Saving
    </button>
  `,
})
class UploadProgressComponent {
  uploaded = signal<number | null>(null);
  color = signal<string | undefined>(undefined);
}

@Component({
  selector: 'et-scenario-label-probe',
  template: `{{ labels().loading }}|{{ labels().loadingContent }}`,
})
class LoaderLabelProbeComponent {
  labels = injectLoaderLabels();
}

@Component({
  selector: 'et-scenario-app-loading',
  imports: [BrandLoaderComponent, LoaderLabelProbeComponent],
  template: `
    <et-brand-loader class="first" />
    <et-brand-loader class="second" />
    <et-scenario-label-probe />
  `,
})
class AppLoadingComponent {
  source = inject(LOADER_LABELS);
}

describe('loader scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('shows upload progress as a determinate bar and spinner after an indeterminate preparing phase', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(UploadProgressComponent);
    const page = fixture.componentInstance;

    s.tick();

    const bar = query('et-progress-bar');
    const spinner = query('et-spinner:not(.inline)');

    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-label')).toBe('Upload team-a roster');
    expect(bar.classList).toContain('et-progress-bar--indeterminate');
    expect(ariaValues(bar)).toEqual([null, null, null]);
    expect(spinner.getAttribute('role')).toBe('progressbar');
    expect(spinner.classList).not.toContain('et-spinner--determinate');
    expect(spinner.querySelector('.et-spinner-indeterminate-container')?.getAttribute('aria-hidden')).toBe('true');
    expect(ariaValues(spinner)).toEqual([null, null, null]);

    page.uploaded.set(40);
    s.tick();

    expect(bar.classList).not.toContain('et-progress-bar--indeterminate');
    expect(ariaValues(bar)).toEqual(['40', '0', '100']);
    expect(bar.querySelector<HTMLElement>('.et-progress-bar__bar--primary')?.style.transform).toBe('scaleX(0.4)');
    expect(spinner.classList).toContain('et-spinner--determinate');
    expect(ariaValues(spinner)).toEqual(['40', '0', '100']);
    expect(spinner.querySelector('.et-spinner-indeterminate-container')).toBeNull();
    expect(spinner.querySelector('.et-spinner-track-container')).not.toBeNull();
    expect(spinner.style.getPropertyValue('--et-spinner-size')).toBe('48px');
    expect(spinner.style.getPropertyValue('--et-spinner-stroke-width')).toBe('4px');

    const circle = spinner.querySelector<SVGCircleElement>('.et-spinner-determinate-circle')!;
    const circumference = parseFloat(circle.style.strokeDasharray);

    expect(parseFloat(circle.style.strokeDashoffset)).toBeCloseTo(circumference * 0.6, 3);

    page.uploaded.set(140);
    s.tick();

    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(bar.querySelector<HTMLElement>('.et-progress-bar__bar--primary')?.style.transform).toBe('scaleX(1)');
    expect(spinner.getAttribute('aria-valuenow')).toBe('100');
    expect(parseFloat(circle.style.strokeDashoffset)).toBeCloseTo(0, 3);

    page.uploaded.set(-5);
    s.tick();
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
  });

  it('bundles the spinner and the progress bar in LOADER_IMPORTS', () => {
    expect(LOADER_IMPORTS).toEqual(expect.arrayContaining([SpinnerComponent, ProgressBarComponent]));
  });

  it('inherits the context colour until a colour is set on the spinner or the bar', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(UploadProgressComponent);

    s.tick();

    const spinner = query('et-spinner:not(.inline)');
    const inline = query('et-spinner.inline');
    const bar = query('et-progress-bar');

    expect(bar.classList).not.toContain('et-progress-bar--themed');
    expect(spinner.classList).not.toContain('et-spinner--themed');
    expect(inline.classList).not.toContain('et-spinner--themed');
    expect(inline.getAttribute('aria-label')).toBe(DEFAULT_LOADER_LABELS.loading);
    expect(spinner.getAttribute('aria-label')).toBe('Upload progress');

    fixture.componentInstance.color.set('accent');
    s.tick();

    expect(spinner.classList).toContain('et-spinner--themed');
    expect(spinner.classList).toContain('et-color--accent');
    expect(bar.classList).toContain('et-progress-bar--themed');
    expect(bar.classList).toContain('et-color--accent');
    expect(inline.classList).not.toContain('et-spinner--themed');
  });

  it('announces the brand loader with the default label and gives each instance its own clip paths', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AppLoadingComponent);

    s.tick();

    const first = query('et-brand-loader.first');
    const second = query('et-brand-loader.second');

    expect(first.getAttribute('role')).toBe('progressbar');
    expect(first.getAttribute('aria-label')).toBe(DEFAULT_LOADER_LABELS.loading);
    expect(first.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(query('et-scenario-label-probe').textContent).toBe(
      `${DEFAULT_LOADER_LABELS.loading}|${DEFAULT_LOADER_LABELS.loadingContent}`,
    );
    expect(fixture.componentInstance.source).toEqual({});

    const clipIds = (host: Element) => Array.from(host.querySelectorAll('clipPath')).map((clip) => clip.id);
    const firstIds = clipIds(first);

    expect(firstIds).toHaveLength(2);
    expect(firstIds.some((id) => clipIds(second).includes(id))).toBe(false);
    expect(first.querySelector('.et-brand-loader__fill')?.getAttribute('clip-path')).toBe(`url(#${firstIds[1]})`);
  });
});

describe('loader scenarios with localized labels', () => {
  const scenario = useScenario({
    providers: [provideLoaderLabels((locale) => (locale.startsWith('de') ? { loading: 'Lädt' } : {}))],
  });

  it('re-announces the brand loader when the locale changes', () => {
    const s = scenario();

    TestBed.createComponent(AppLoadingComponent);
    s.tick();

    expect(query('et-brand-loader').getAttribute('aria-label')).toBe(DEFAULT_LOADER_LABELS.loading);

    s.run(() => injectLocale().currentLocale.set('de-DE'));
    s.tick();

    expect(query('et-brand-loader').getAttribute('aria-label')).toBe('Lädt');
    expect(query('et-scenario-label-probe').textContent).toBe(`Lädt|${DEFAULT_LOADER_LABELS.loadingContent}`);
  });

  it('names a spinner without an aria-label from the localized loader labels, and keeps its own aria-label', () => {
    const s = scenario();

    TestBed.createComponent(UploadProgressComponent);
    s.run(() => injectLocale().currentLocale.set('de-DE'));
    s.tick();

    const inline = query('et-spinner.inline');

    expect(inline.getAttribute('role')).toBe('progressbar');
    expect(inline.getAttribute('aria-label')).toBe('Lädt');
    expect(query('et-spinner:not(.inline)').getAttribute('aria-label')).toBe('Upload progress');
    expect(inline.hasAttribute('aria-labelledby')).toBe(false);
    expect(inline.textContent?.trim()).toBe('');
  });
});
