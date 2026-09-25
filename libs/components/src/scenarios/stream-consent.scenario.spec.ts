import { Component, inject, Injectable, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, createUserConsentProvider, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  injectStreamConfig,
  injectStreamConsentConfig,
  injectStreamUserConsentProvider,
  KickPlayerSlotComponent,
  provideStreamConfig,
  provideStreamConsentConfig,
  provideStreamLabels,
  STREAM_CONSENT_TOKEN,
  STREAM_IMPORTS,
  STREAM_KICK_IMPORTS,
  STREAM_USER_CONSENT_PROVIDER_TOKEN,
  StreamConsentAcceptDirective,
  StreamConsentComponent,
  StreamConsentDirective,
} from '../index';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'accent', primary: swatch('120 20 160') },
];

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

@Injectable({ providedIn: 'root' })
class CookieBanner {
  mediaConsent = signal(false);
}

const provideMediaConsent = () =>
  createUserConsentProvider({
    for: STREAM_USER_CONSENT_PROVIDER_TOKEN,
    isGranted: () => inject(CookieBanner).mediaConsent.asReadonly(),
    grant: () => {
      const banner = inject(CookieBanner);

      return () => banner.mediaConsent.set(true);
    },
  });

@Component({
  selector: 'et-scenario-gated-stream',
  imports: [STREAM_IMPORTS, STREAM_KICK_IMPORTS],
  providers: [provideStreamConfig({ consentComponent: StreamConsentComponent })],
  template: `<et-kick-player-slot channel="arena" />`,
})
class GatedStreamComponent {
  config = injectStreamConfig();
  consent = injectStreamUserConsentProvider();
}

@Component({
  selector: 'et-scenario-banner-and-card-stream',
  imports: [KickPlayerSlotComponent],
  providers: [provideStreamConfig({ consentComponent: StreamConsentComponent }), provideMediaConsent()],
  template: `<et-kick-player-slot channel="arena" />`,
})
class BannerAndCardStreamComponent {
  consent = injectStreamUserConsentProvider();
}

@Component({
  selector: 'et-scenario-branded-consent',
  imports: [StreamConsentAcceptDirective],
  hostDirectives: [StreamConsentDirective],
  template: `
    <p class="notice">This stream is hosted by a third party.</p>
    <button class="agree" etStreamConsentAccept type="button">Agree</button>
    <button (click)="consent.revoke()" class="decline" type="button">Decline</button>
  `,
})
class BrandedConsentComponent {
  consent = inject(STREAM_CONSENT_TOKEN);
}

@Component({
  selector: 'et-scenario-branded-stream',
  imports: [STREAM_IMPORTS, STREAM_KICK_IMPORTS],
  providers: [provideStreamConfig({ consentComponent: BrandedConsentComponent })],
  template: `<et-kick-player-slot channel="arena" />`,
})
class BrandedStreamComponent {}

@Component({
  selector: 'et-scenario-bare-consent',
  template: `<button type="button">Agree</button>`,
})
class BareConsentComponent {}

@Component({
  selector: 'et-scenario-misconfigured-stream',
  imports: [KickPlayerSlotComponent],
  providers: [provideStreamConfig({ consentComponent: BareConsentComponent })],
  template: `<et-kick-player-slot channel="arena" />`,
})
class MisconfiguredStreamComponent {}

@Component({
  selector: 'et-scenario-banner-gated-stream',
  imports: [KickPlayerSlotComponent],
  providers: [provideMediaConsent()],
  template: `<et-kick-player-slot channel="arena" />`,
})
class BannerGatedStreamComponent {
  consent = injectStreamUserConsentProvider();
}

const player = (host: HTMLElement) => host.querySelector('et-kick-player');

describe('stream consent scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideColorThemesWithTailwind4(COLOR_THEMES),
      ...provideStreamConsentConfig({ acceptButtonColor: 'accent' }),
      provideStreamLabels({ consentHeading: 'Inhalt blockiert', consentAccept: 'Erlauben und abspielen' }),
    ],
  });

  const mount = <T>(s: Scenario, component: Type<T>) => {
    const fixture = TestBed.createComponent(component);

    s.flush();

    return fixture;
  };

  it('holds the player back behind the built-in consent card until the viewer allows it', () => {
    const s = scenario();
    const fixture = mount(s, GatedStreamComponent);
    const host = fixture.nativeElement as HTMLElement;
    const card = query('et-stream-consent', host);

    expect(fixture.componentInstance.config.consentComponent).toBe(StreamConsentComponent);
    expect(fixture.componentInstance.consent).toBeNull();
    expect(player(host)).toBeNull();
    expect(card.getAttribute('role')).toBe('group');

    const heading = query('h3', card);

    expect(card.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.textContent?.trim()).toBe('Inhalt blockiert');

    const accept = query('button', card);

    expect(accept.textContent?.trim()).toBe('Erlauben und abspielen');
    expect(accept.className).toContain('et-color--accent');
    expect(s.run(() => injectStreamConsentConfig()).acceptButtonColor).toBe('accent');

    accept.click();
    s.flush();

    expect(host.querySelector('et-stream-consent')).toBeNull();
    expect(player(host)).not.toBeNull();
  });

  it('writes the decision back to the app consent source and skips the card once it is granted', () => {
    const s = scenario();
    const first = mount(s, BannerAndCardStreamComponent);
    const firstHost = first.nativeElement as HTMLElement;

    expect(first.componentInstance.consent?.isGranted()).toBe(false);

    query('et-stream-consent button', firstHost).click();
    s.flush();

    expect(TestBed.inject(CookieBanner).mediaConsent()).toBe(true);
    expect(player(firstHost)).not.toBeNull();

    const second = TestBed.createComponent(BannerAndCardStreamComponent);
    const secondHost = second.nativeElement as HTMLElement;

    s.flush();

    expect(secondHost.querySelector('et-stream-consent')).toBeNull();
    expect(player(secondHost)).not.toBeNull();
  });

  it('waits for the app consent source when no consent card is configured', () => {
    const s = scenario();
    const fixture = mount(s, BannerGatedStreamComponent);
    const host = fixture.nativeElement as HTMLElement;

    expect(player(host)).toBeNull();

    fixture.componentInstance.consent?.grant();
    s.flush();

    expect(player(host)).not.toBeNull();
  });

  it('renders an app-branded consent gate built on the headless consent directive', () => {
    const s = scenario();
    const fixture = mount(s, BrandedStreamComponent);
    const host = fixture.nativeElement as HTMLElement;
    const gate = query('et-scenario-branded-consent', host);

    query('.decline', gate).click();
    s.flush();
    expect(player(host)).toBeNull();

    query('.agree', gate).click();
    s.flush();

    expect(host.querySelector('et-scenario-branded-consent')).toBeNull();
    expect(player(host)).not.toBeNull();
  });

  it('reports a consent component that lacks the consent directive', () => {
    const s = scenario();
    const fixture = mount(s, MisconfiguredStreamComponent);

    const host = fixture.nativeElement as HTMLElement;

    s.expectError('STREAM_CONSENT_TOKEN');

    const payload = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

    expect(payload).not.toBe(-1);
    expect((s.errors.splice(payload, 1)[0]?.error as { element: HTMLElement }).element).toBe(
      query('et-kick-player-slot', host),
    );
    expect(player(host)).toBeNull();
  });
});
