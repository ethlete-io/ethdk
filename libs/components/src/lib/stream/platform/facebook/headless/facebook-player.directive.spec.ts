import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RuntimeError, injectLocale } from '@ethlete/core';
import { of, throwError } from 'rxjs';
import '../../../../../test-helpers';
import { provideStreamConfig } from '../../../stream-config';
import { STREAM_ERROR_CODES } from '../../../stream-errors';
import { injectStreamScriptLoader } from '../../../stream-script-loader';
import { FacebookPlayerParamsDirective } from './facebook-player-params.directive';
import { FacebookPlayerDirective } from './facebook-player.directive';
import { FacebookWindow } from './facebook-player.types';

@Component({
  selector: 'et-test-facebook-host',
  template: '',
  hostDirectives: [
    { directive: FacebookPlayerParamsDirective, inputs: ['videoId', 'width', 'height'] },
    FacebookPlayerDirective,
  ],
})
class HostComponent {}

const win = window as unknown as Partial<FacebookWindow>;

type Handler = () => void;

class FakeFacebookVideo {
  handlers = new Map<string, Handler>();
  released: string[] = [];
  calls: string[] = [];

  subscribe(event: string, handler: Handler) {
    this.handlers.set(event, handler);

    return { release: () => this.released.push(event) };
  }
  emit(event: string) {
    this.handlers.get(event)?.();
  }
  play() {
    this.calls.push('play');
  }
  pause() {
    this.calls.push('pause');
  }
  mute() {
    this.calls.push('mute');
  }
  unmute() {
    this.calls.push('unmute');
  }
  seek(seconds: number) {
    this.calls.push(`seek:${seconds}`);
  }
}

const createFakeFb = () => {
  const readyHandlers = new Set<(msg: unknown) => void>();
  const parse = vi.fn();

  return {
    parse,
    readyHandlers,
    FB: {
      Event: {
        subscribe: (_event: string, handler: (msg: unknown) => void) => readyHandlers.add(handler),
        unsubscribe: (_event: string, handler: (msg: unknown) => void) => readyHandlers.delete(handler),
      },
      XFBML: { parse },
    } as unknown as FacebookWindow['FB'],
  };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = async (options: { videoId?: string; locale?: string; inputs?: Record<string, unknown> } = {}) => {
  const loader = TestBed.runInInjectionContext(() => injectStreamScriptLoader());
  const load = vi.spyOn(loader, 'load').mockReturnValue(of(undefined));

  if (options.locale) TestBed.runInInjectionContext(() => injectLocale()).currentLocale.set(options.locale);

  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentRef.setInput('videoId', options.videoId ?? '987');

  for (const [key, value] of Object.entries(options.inputs ?? {})) {
    fixture.componentRef.setInput(key, value);
  }

  const settle = async () => {
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
  };

  await settle();

  const host = fixture.nativeElement as HTMLElement;
  const fake = createFakeFb();

  return {
    fixture,
    load,
    settle,
    host,
    fake,
    player: fixture.debugElement.injector.get(FacebookPlayerDirective),
    container: () => host.querySelector<HTMLElement>('.fb-video'),
    sdkLoaded: async () => {
      win.FB = fake.FB;
      win.fbAsyncInit?.();
      await settle();
    },
    videoReady: async (video = new FakeFacebookVideo(), id?: string) => {
      const containerId = id ?? host.querySelector<HTMLElement>('.fb-video')?.id;
      fake.readyHandlers.forEach((handler) => handler({ type: 'video', id: containerId, instance: video }));
      await settle();

      return video;
    },
  };
};

describe('FacebookPlayerDirective', () => {
  afterEach(() => {
    delete win.FB;
    delete win.fbAsyncInit;
  });

  describe('SDK url', () => {
    const urlFor = async (locale: string | undefined) => {
      const { load } = await setup({ locale });

      return load.mock.calls[0]?.[0];
    };

    it('should complete a bare language to its most likely region', async () => {
      expect(await urlFor('de')).toBe('https://connect.facebook.net/de_DE/sdk.js#xfbml=1&version=v26.0');
    });

    it('should use the default locale when none was set', async () => {
      expect(await urlFor(undefined)).toBe('https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v26.0');
    });

    it('should keep an explicit region', async () => {
      expect(await urlFor('de-AT')).toContain('/de_AT/');
    });

    it('should accept an underscore separated locale', async () => {
      expect(await urlFor('fr_CA')).toContain('/fr_CA/');
    });

    it('should fall back to en_US for an invalid locale', async () => {
      expect(await urlFor('not a locale!')).toContain('/en_US/');
    });

    it('should use the configured SDK version, url encoded', async () => {
      TestBed.configureTestingModule({ providers: [provideStreamConfig({ facebookSdkVersion: 'v30.0&x' })] });

      const { load } = await setup();

      expect(load.mock.calls[0]?.[0]).toContain('version=v30.0%26x');
    });
  });

  it('should not load the SDK again when FB is already on the window', async () => {
    const fake = createFakeFb();
    win.FB = fake.FB;

    const { load, container } = await setup();

    expect(load).not.toHaveBeenCalled();
    expect(container()).not.toBeNull();
  });

  it('should wait for fbAsyncInit before creating the embed and chain the previous callback', async () => {
    const previous = vi.fn();
    win.fbAsyncInit = previous;

    const { container, sdkLoaded, fake } = await setup();

    expect(container()).toBeNull();

    await sdkLoaded();

    expect(previous).toHaveBeenCalledTimes(1);
    expect(container()).not.toBeNull();
    expect(fake.parse).toHaveBeenCalledTimes(1);
  });

  it('should report FACEBOOK_SDK_NOT_AVAILABLE when FB is missing after the SDK init', async () => {
    const { player, settle } = await setup();

    win.fbAsyncInit?.();
    await settle();

    expect((player.state().error as Error).message).toContain(`ET${STREAM_ERROR_CODES.FACEBOOK_SDK_NOT_AVAILABLE}`);
    expect(player.state().isLoading).toBe(false);
  });

  it('should surface a script load failure', async () => {
    const loader = TestBed.runInInjectionContext(() => injectStreamScriptLoader());
    vi.spyOn(loader, 'load').mockReturnValue(
      throwError(() => new RuntimeError(STREAM_ERROR_CODES.SCRIPT_LOAD_FAILED, 'blocked')),
    );

    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentRef.setInput('videoId', '1');
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const player = fixture.debugElement.injector.get(FacebookPlayerDirective);

    expect((player.state().error as Error).message).toContain(`ET${STREAM_ERROR_CODES.SCRIPT_LOAD_FAILED}`);
    expect(player.state().isLoading).toBe(false);
  });

  it('should render a fb-video container for the encoded video url', async () => {
    const { sdkLoaded, container } = await setup({ videoId: 'a b/1' });
    await sdkLoaded();

    expect(container()?.dataset['href']).toBe('https://www.facebook.com/video/a%20b%2F1');
    expect(container()?.dataset['showText']).toBe('false');
    expect(container()?.id).toMatch(/^et-fb-/);
  });

  it('should size the host for a numeric width and let a string width through', async () => {
    const numeric = await setup({ inputs: { width: '480', height: '270' } });
    await numeric.sdkLoaded();

    expect(numeric.container()?.dataset['width']).toBe('480');
    expect(numeric.host.style.width).toBe('480px');
    expect(numeric.host.style.height).toBe('270px');
  });

  it('should use an automatic embed width for a relative width', async () => {
    const { sdkLoaded, container, host } = await setup({ inputs: { width: '50%', height: '50%' } });
    await sdkLoaded();

    expect(container()?.dataset['width']).toBe('auto');
    expect(host.style.width).toBe('50%');
    expect(host.style.height).toBe('');
  });

  it('should be loading until the video reports ready', async () => {
    const { player, sdkLoaded } = await setup();
    await sdkLoaded();

    expect(player.state()).toMatchObject({ isReady: false, isLoading: true });
  });

  it('should become ready when its own video reports xfbml.ready', async () => {
    const { player, sdkLoaded, videoReady } = await setup();
    await sdkLoaded();
    await videoReady();

    expect(player.state()).toMatchObject({ isReady: true, isLoading: false, error: null });
  });

  it('should ignore xfbml.ready for other containers and other element types', async () => {
    const { player, sdkLoaded, videoReady, fake, settle } = await setup();
    await sdkLoaded();

    await videoReady(undefined, 'et-fb-someone-else');
    fake.readyHandlers.forEach((handler) => handler({ type: 'comments', id: 'x', instance: {} }));
    await settle();

    expect(player.state().isReady).toBe(false);
  });

  it('should track playing, paused and finished', async () => {
    const { player, sdkLoaded, videoReady } = await setup();
    await sdkLoaded();
    const video = await videoReady();

    video.emit('startedPlaying');

    expect(player.state()).toMatchObject({ isPlaying: true, isEnded: false });

    video.emit('paused');

    expect(player.state().isPlaying).toBe(false);

    video.emit('finishedPlaying');

    expect(player.state()).toMatchObject({ isPlaying: false, isEnded: true });

    video.emit('startedPlaying');

    expect(player.state().isEnded).toBe(false);
  });

  it('should forward the controls to the video', async () => {
    const { player, sdkLoaded, videoReady } = await setup();
    await sdkLoaded();
    const video = await videoReady();

    player.play();
    player.pause();
    player.mute();
    player.unmute();
    player.seek(8);

    expect(video.calls).toEqual(['play', 'pause', 'mute', 'unmute', 'seek:8']);
  });

  it('should reflect mute and unmute in the state', async () => {
    const { player } = await setup();

    player.mute();

    expect(player.state().isMuted).toBe(true);

    player.unmute();

    expect(player.state().isMuted).toBe(false);
  });

  it('should report FACEBOOK_VIDEO_UNAVAILABLE when the video never becomes ready', async () => {
    const { player, fixture } = await setup();
    vi.useFakeTimers();

    try {
      win.FB = createFakeFb().FB;
      win.fbAsyncInit?.();
      await vi.advanceTimersByTimeAsync(14_999);

      expect(player.state().error).toBeNull();

      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();

      expect((player.state().error as Error).message).toContain(`ET${STREAM_ERROR_CODES.FACEBOOK_VIDEO_UNAVAILABLE}`);
      expect(player.state().isLoading).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not time out once the video is ready', async () => {
    const { player, sdkLoaded, videoReady, fixture } = await setup();
    await sdkLoaded();
    await videoReady();
    vi.useFakeTimers();

    try {
      await vi.advanceTimersByTimeAsync(20_000);
      fixture.detectChanges();

      expect(player.state()).toMatchObject({ isReady: true, error: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('should release subscriptions, unsubscribe from FB, clear the host and reset the state when destroyed', async () => {
    const { player, sdkLoaded, videoReady, fake, host, fixture } = await setup();
    await sdkLoaded();
    const video = await videoReady();

    fixture.destroy();

    expect(video.released.sort()).toEqual(['finishedPlaying', 'paused', 'startedPlaying']);
    expect(fake.readyHandlers.size).toBe(0);
    expect(host.innerHTML).toBe('');
    expect(player.state()).toMatchObject({ isReady: false, isLoading: true });
  });

  it('should ignore a late SDK init after destroy', async () => {
    const { fixture, fake } = await setup();

    fixture.destroy();
    win.FB = fake.FB;
    win.fbAsyncInit?.();

    expect(fake.parse).not.toHaveBeenCalled();
  });

  it('should build a new embed when the video id changes', async () => {
    const { fixture, sdkLoaded, settle, host } = await setup({ videoId: '1' });
    await sdkLoaded();
    const first = host.querySelector('.fb-video')?.id;

    fixture.componentRef.setInput('videoId', '2');
    await settle();
    win.fbAsyncInit?.();
    await settle();

    expect(host.querySelectorAll('.fb-video')).toHaveLength(1);
    expect(host.querySelector('.fb-video')?.id).not.toBe(first);
    expect(host.querySelector<HTMLElement>('.fb-video')?.dataset['href']).toContain('/2');
  });

  it('should rebuild the embed and clear the error on retry after a failure', async () => {
    const { player, settle, host } = await setup();

    win.fbAsyncInit?.();
    await settle();

    expect(player.state().error).not.toBeNull();

    win.FB = createFakeFb().FB;
    player.retry();
    await settle();

    expect(player.state().error).toBeNull();
    expect(host.querySelector('.fb-video')).not.toBeNull();
  });
});
