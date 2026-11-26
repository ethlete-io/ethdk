import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  BANNER_IMPORTS,
  BANNER_LABELS,
  BANNER_TYPES,
  BannerComponent,
  BannerType,
  DEFAULT_BANNER_LABELS,
  injectBannerLabels,
  provideBannerLabels,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'brand', primary: swatch('90 0 200') },
  { name: 'ok', type: 'success', primary: swatch('0 160 60') },
  { name: 'caution', type: 'warning', primary: swatch('220 160 0') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

@Component({
  selector: 'et-scenario-status-banners',
  imports: [BANNER_IMPORTS],
  template: `
    @for (type of types; track type) {
      <et-banner [type]="type" [heading]="type + ' heading'" description="Details follow." />
    }

    <et-banner
      [liveRegion]="liveRegion()"
      [color]="color()"
      (dismiss)="dismissed = dismissed + 1"
      class="save-banner"
      heading="Unsaved changes"
      type="warning"
      dismissible
    >
      <i class="banner-icon" etIcon="et-triangle-exclamation"></i>
      <h3 class="custom-heading" etBannerHeading>Draft for team-a</h3>
      <ul class="custom-body" etBannerBody>
        <li>Two fields changed</li>
      </ul>
      <button (click)="saved = saved + 1" class="save" etBannerAction type="button">Save</button>
    </et-banner>
  `,
})
class StatusBannersComponent {
  types = Object.values(BANNER_TYPES);
  liveRegion = signal<'alert' | 'status' | null | undefined>(undefined);
  color = signal<string | null>(null);
  dismissed = 0;
  saved = 0;
}

@Component({
  selector: 'et-scenario-banner-label-probe',
  template: `{{ labels().dismiss }}|{{ token.dismiss }}`,
})
class BannerLabelProbeComponent {
  labels = injectBannerLabels();
  token = inject(BANNER_LABELS);
}

@Component({
  selector: 'et-scenario-localized-banner',
  imports: [BannerComponent, BannerLabelProbeComponent],
  template: `
    <et-banner [type]="type" heading="Gespeichert" dismissible />
    <et-scenario-banner-label-probe />
  `,
})
class LocalizedBannerComponent {
  type: BannerType = BANNER_TYPES.SUCCESS;
}

describe('banner scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('announces each type with the right live region and tints it with the semantic theme', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StatusBannersComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    const banners = Array.from(host.querySelectorAll('et-banner')).slice(0, 4);

    expect(banners.map((banner) => banner.getAttribute('data-type'))).toEqual(['info', 'success', 'warning', 'error']);
    expect(banners.map((banner) => banner.getAttribute('role'))).toEqual(['status', 'status', 'alert', 'alert']);
    expect(banners.map((banner) => text(banner.querySelector('.et-banner-heading')))).toEqual([
      'info heading',
      'success heading',
      'warning heading',
      'error heading',
    ]);
    expect(banners.map((banner) => text(banner.querySelector('.et-banner-description')))).toEqual([
      'Details follow.',
      'Details follow.',
      'Details follow.',
      'Details follow.',
    ]);
    expect(banners[0]?.classList).toContain('et-color--inherited');
    expect(banners[1]?.classList).toContain('et-color--ok');
    expect(banners[2]?.classList).toContain('et-color--caution');
    expect(banners[3]?.classList).toContain('et-color--alert');
    expect(banners.every((banner) => !banner.querySelector('.et-banner-dismiss-btn'))).toBe(true);
    expect(s.errors).toEqual([]);
  });

  it('projects the consumer slots, dismisses through the output and honors the overrides', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StatusBannersComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const banner = query('.save-banner', host);
    const content = query('.et-banner-content', banner);

    expect(banner.firstElementChild?.classList).toContain('banner-icon');
    expect(Array.from(content.children).map((child) => child.className)).toEqual([
      'et-banner-heading',
      'custom-heading',
      'custom-body',
      'save',
    ]);
    expect(text(query('.custom-body', content))).toBe('Two fields changed');

    query<HTMLButtonElement>('.save', banner).click();
    expect(app.saved).toBe(1);
    expect(app.dismissed).toBe(0);

    const dismiss = query<HTMLButtonElement>('.et-banner-dismiss-btn', banner);

    expect(dismiss.type).toBe('button');
    expect(dismiss.getAttribute('aria-label')).toBe(DEFAULT_BANNER_LABELS.dismiss);
    dismiss.click();
    dismiss.click();
    expect(app.dismissed).toBe(2);

    expect(banner.getAttribute('role')).toBe('alert');
    app.liveRegion.set(null);
    s.tick();
    expect(banner.hasAttribute('role')).toBe(false);
    app.liveRegion.set('status');
    s.tick();
    expect(banner.getAttribute('role')).toBe('status');

    expect(banner.classList).toContain('et-color--caution');
    app.color.set('brand');
    s.tick();
    expect(banner.classList).toContain('et-color--brand');
    app.color.set(null);
    s.tick();
    expect(banner.classList).toContain('et-color--caution');
    expect(s.errors).toEqual([]);
  });
});

describe('banner label scenarios', () => {
  const scenario = useScenario({
    providers: [provideColorThemesWithTailwind4(COLOR_THEMES), provideBannerLabels({ dismiss: 'Schließen' })],
  });

  it('localizes the dismiss button for everything below the provider', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LocalizedBannerComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    expect(query('.et-banner-dismiss-btn', host).getAttribute('aria-label')).toBe('Schließen');
    expect(text(query('et-scenario-banner-label-probe', host))).toBe('Schließen|Schließen');
    expect(query('et-banner', host).getAttribute('role')).toBe('status');
  });
});
