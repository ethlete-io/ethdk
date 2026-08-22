import { Component, Directive, Type, ViewEncapsulation, createComponent, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConsentHandler } from '@ethlete/core';
import '../../test-helpers';
import {
  STREAM_USER_CONSENT_PROVIDER_TOKEN,
  StreamConsentDirective,
} from './consent/headless/stream-consent.directive';
import { provideStreamConfig } from './stream-config';
import { injectStreamManager } from './stream-manager';
import { STREAM_PLAYER_TOKEN, StreamPlayer } from './stream-player';
import { createStreamPlayerSlot } from './stream-player-slot';
import { DEFAULT_STREAM_PLAYER_STATE } from './stream.types';

const FAKE_PLAYER: StreamPlayer = {
  CAPABILITIES: {
    canPlay: true,
    canPause: true,
    canMute: true,
    canSeek: true,
    canGetDuration: true,
    isLiveCapable: false,
    hasThumbnail: false,
  },
  state: signal(DEFAULT_STREAM_PLAYER_STATE),
  thumbnail: signal(null),
  play: () => undefined,
  pause: () => undefined,
  mute: () => undefined,
  unmute: () => undefined,
  seek: () => undefined,
  retry: () => undefined,
};

@Component({
  selector: 'et-fake-stream-player',
  template: '',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: STREAM_PLAYER_TOKEN, useValue: FAKE_PLAYER }],
})
class FakeStreamPlayerComponent {}

@Component({
  selector: 'et-fake-stream-chrome',
  template: '',
  encapsulation: ViewEncapsulation.None,
})
class FakeStreamChromeComponent {}

@Component({
  selector: 'et-fake-stream-consent',
  template: '',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [StreamConsentDirective],
})
class FakeStreamConsentComponent {}

@Directive({ selector: '[etTestStreamSlot]' })
class TestStreamSlotDirective {
  public playerId = signal('youtube-old');
  public priority = signal(false);
  public onPipBack = signal<(() => void) | undefined>(undefined);

  public slot = createStreamPlayerSlot({
    playerId: this.playerId,
    aspectRatio: 16 / 9,
    streamSlotPriority: this.priority,
    streamSlotOnPipBack: this.onPipBack,
    createPlayer: (envInjector, elementInjector) =>
      createComponent(FakeStreamPlayerComponent, { environmentInjector: envInjector, elementInjector }),
  });
}

@Component({
  selector: 'et-test-stream-host',
  template: '<div etTestStreamSlot></div>',
  encapsulation: ViewEncapsulation.None,
  imports: [TestStreamSlotDirective],
})
class TestStreamHostComponent {}

describe('createStreamPlayerSlot', () => {
  let isGranted: ReturnType<typeof signal<boolean>>;
  let fixture: ComponentFixture<TestStreamHostComponent>;

  const configure = (consentComponent: Type<unknown> | null) => {
    isGranted = signal(false);

    const handler: ConsentHandler = {
      isGranted,
      grant: () => isGranted.set(true),
      revoke: () => isGranted.set(false),
    };

    TestBed.configureTestingModule({
      imports: [TestStreamHostComponent],
      providers: [
        { provide: STREAM_USER_CONSENT_PROVIDER_TOKEN, useValue: handler },
        ...provideStreamConfig({
          consentComponent,
          loadingComponent: FakeStreamChromeComponent,
          errorComponent: FakeStreamChromeComponent,
        }),
      ],
    });

    fixture = TestBed.createComponent(TestStreamHostComponent);
  };

  const slotDirective = () =>
    fixture.debugElement.query(By.directive(TestStreamSlotDirective)).injector.get(TestStreamSlotDirective);

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const streamManager = () => TestBed.runInInjectionContext(() => injectStreamManager());

  it('registers the live player id when consent arrives after an id change', async () => {
    configure(null);
    await settle();

    const directive = slotDirective();
    directive.playerId.set('youtube-new');
    await settle();

    isGranted.set(true);
    await settle();

    expect(directive.slot.currentPlayerIdSignal()).toBe('youtube-new');
    expect(streamManager().getPlayerElement('youtube-new')).not.toBeNull();
    expect(streamManager().getPlayerElement('youtube-old')).toBeNull();
  });

  it('registers the live player id when the consent component is accepted after an id change', async () => {
    configure(FakeStreamConsentComponent);
    await settle();

    const directive = slotDirective();
    directive.playerId.set('youtube-new');
    await settle();

    const consentHost = fixture.nativeElement.querySelector('et-fake-stream-consent') as HTMLElement;
    expect(consentHost).not.toBeNull();

    TestBed.inject(STREAM_USER_CONSENT_PROVIDER_TOKEN)?.grant();
    await settle();

    expect(streamManager().getPlayerElement('youtube-new')).not.toBeNull();
    expect(streamManager().getPlayerElement('youtube-old')).toBeNull();
  });

  it('registers the current player id when consent is already granted', async () => {
    configure(null);
    isGranted.set(true);
    await settle();

    expect(streamManager().getPlayerElement('youtube-old')).not.toBeNull();
  });
});
