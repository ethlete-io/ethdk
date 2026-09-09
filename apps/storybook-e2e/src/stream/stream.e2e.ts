import { Locator, Page, expect, test } from '@playwright/test';
import { expectTouchMode, openStory, tabSequence, tap } from '../support';

const YOUTUBE_STORY_ID = 'components-media-stream-youtube--default';
const YOUTUBE_LIVE_STORY_ID = 'components-media-stream-youtube--live-stream';
const YOUTUBE_CONSENT_STORY_ID = 'components-media-stream-youtube--slot-with-consent';
const TWITCH_CHANNEL_STORY_ID = 'components-media-stream-twitch--live-channel';
const TWITCH_VOD_STORY_ID = 'components-media-stream-twitch--vod';
const VIMEO_STORY_ID = 'components-media-stream-vimeo--default';
const FACEBOOK_STORY_ID = 'components-media-stream-facebook--default';
const KICK_STORY_ID = 'components-media-stream-kick--live-stream';
const SOOP_STORY_ID = 'components-media-stream-soop--live-stream';
const DAILYMOTION_STORY_ID = 'components-media-stream-dailymotion--default';
const TIKTOK_STORY_ID = 'components-media-stream-tiktok--default';
const MIXED_STORY_ID = 'components-media-stream-mixed--mixed-aspect-ratios';

const SLOT = '.et-stream-player-slot';
const CONSENT = '.et-stream-consent';
const LOADING = '.et-stream-player-loading';
const ERROR = '.et-stream-player-error';
const FACEBOOK_CONTAINER = '.fb-video';

const YT_API_URL = 'https://www.youtube.com/iframe_api';

/**
 * The stories embed real providers. Every request that leaves the Storybook origin is either
 * aborted or answered with the stub below, so no assertion in this file depends on YouTube,
 * Twitch, Vimeo or Facebook being reachable.
 */
const FIRST_PARTY_HOSTS = ['localhost', '127.0.0.1'];

/**
 * The smallest surface of each platform SDK the matching directive actually touches, plus a
 * recorder for the options it was handed. Widen a stub only when its directive starts calling
 * something new - a missing member surfaces as the slot's failure overlay, not as an error.
 */
const YOUTUBE_SDK_STUB = `
  window.__etYoutubeEmbeds = [];
  window.YT = {
    PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    Player: function (element, options) {
      window.__etYoutubeEmbeds.push({
        videoId: options.videoId,
        width: options.width,
        height: options.height,
        playerVars: options.playerVars,
      });
      this.destroy = function () {};
      this.getCurrentTime = function () { return 0; };
      this.getDuration = function () { return 0; };
      this.isMuted = function () { return false; };
      this.playVideo = function () {};
      this.pauseVideo = function () {};
      this.mute = function () {};
      this.unMute = function () {};
      this.seekTo = function () {};
      setTimeout(function () { options.events.onReady(); }, 0);
    },
  };
  if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
`;

const TWITCH_SDK_STUB = `
  window.__etTwitchEmbeds = [];
  function EtTwitchEmbed(element, options) {
    window.__etTwitchEmbeds.push(options);
    this.addEventListener = function (event, callback) {
      if (event === EtTwitchEmbed.READY) setTimeout(callback, 0);
    };
    this.getPlayer = function () {
      return {
        play: function () {}, pause: function () {}, seek: function () {},
        setMuted: function () {}, getMuted: function () { return false; },
        getCurrentTime: function () { return 0; }, getDuration: function () { return 0; },
        addEventListener: function () {},
      };
    };
  }
  EtTwitchEmbed.READY = 'ready';
  EtTwitchEmbed.PLAY = 'play';
  EtTwitchEmbed.PAUSE = 'pause';
  EtTwitchEmbed.ENDED = 'ended';
  window.Twitch = { Embed: EtTwitchEmbed };
`;

const VIMEO_SDK_STUB = `
  window.__etVimeoEmbeds = [];
  window.Vimeo = {
    Player: function (element, options) {
      window.__etVimeoEmbeds.push(options);
      this.on = function () {};
      this.off = function () {};
      this.ready = function () { return Promise.resolve(); };
      this.play = function () { return Promise.resolve(); };
      this.pause = function () { return Promise.resolve(); };
      this.getMuted = function () { return Promise.resolve(false); };
      this.setMuted = function () { return Promise.resolve(false); };
      this.getDuration = function () { return Promise.resolve(120); };
      this.getCurrentTime = function () { return Promise.resolve(0); };
      this.setCurrentTime = function () { return Promise.resolve(0); };
      this.destroy = function () { return Promise.resolve(); };
    },
  };
`;

const FACEBOOK_SDK_STUB = `
  window.__etFacebookParses = 0;
  window.FB = {
    Event: { subscribe: function () {}, unsubscribe: function () {} },
    XFBML: { parse: function () { window.__etFacebookParses++; } },
  };
  if (window.fbAsyncInit) window.fbAsyncInit();
`;

const SDK_STUBS: ReadonlyArray<readonly [string, string]> = [
  ['www.youtube.com/iframe_api', YOUTUBE_SDK_STUB],
  ['embed.twitch.tv/embed/v1.js', TWITCH_SDK_STUB],
  ['player.vimeo.com/api/player.js', VIMEO_SDK_STUB],
  ['connect.facebook.net', FACEBOOK_SDK_STUB],
];

interface YoutubeEmbedRecord {
  videoId: string;
  width: string;
  height: string;
  playerVars: Record<string, string | number>;
}

interface TwitchEmbedRecord {
  width: string;
  height: string;
  parent: string[];
  autoplay: boolean;
  layout: string;
  channel?: string;
  video?: string;
}

interface VimeoEmbedRecord {
  id: string | number;
  responsive: boolean;
}

type StubWindow = Window & {
  __etYoutubeEmbeds?: YoutubeEmbedRecord[];
  __etTwitchEmbeds?: TwitchEmbedRecord[];
  __etVimeoEmbeds?: VimeoEmbedRecord[];
  __etFacebookParses?: number;
};

function isFirstParty(url: string): boolean {
  return FIRST_PARTY_HOSTS.includes(new URL(url).hostname);
}

/** Nothing but the Storybook origin answers; the platform players fall back to their failure overlay. */
async function blockThirdParty(page: Page): Promise<void> {
  await page.route('**/*', (route) => (isFirstParty(route.request().url()) ? route.continue() : route.abort()));
}

/** Like {@link blockThirdParty}, but the four SDK-driven platforms get their recording stub. */
async function stubPlatformSdks(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const url = route.request().url();

    if (isFirstParty(url)) return route.continue();

    const stub = SDK_STUBS.find(([fragment]) => url.includes(fragment));

    if (!stub) return route.abort();

    return route.fulfill({ status: 200, contentType: 'application/javascript', body: stub[1] });
  });
}

function slotAt(root: Locator, index = 0): Locator {
  return root.locator(SLOT).nth(index);
}

function readAspectRatio(slot: Locator): Promise<number> {
  return slot.evaluate((el) => {
    const rect = el.getBoundingClientRect();

    return rect.width / rect.height;
  });
}

test.describe('stream / structure', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: tab order and a wide viewport');

  test('a Kick slot embeds the channel player and names the embedding page', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, KICK_STORY_ID);

    await expect(slotAt(root).locator('iframe')).toHaveAttribute(
      'src',
      'https://player.kick.com/asmongold247?parent=localhost',
    );
  });

  test('a Kick slot stays unmuted unless it is asked to mute', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, KICK_STORY_ID);

    const src = await slotAt(root).locator('iframe').getAttribute('src');

    expect(new URL(src ?? '').searchParams.get('muted')).toBeNull();
  });

  test('a SOOP slot embeds the live channel of a user id', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, SOOP_STORY_ID);

    await expect(slotAt(root).locator('iframe')).toHaveAttribute('src', 'https://play.afreecatv.com/kbsnews/embed');
  });

  test('a SOOP slot embeds a recording when it is given a video id instead', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, SOOP_STORY_ID, { args: { userId: '!null', videoId: '123456' } });

    await expect(slotAt(root).locator('iframe')).toHaveAttribute('src', 'https://vod.afreecatv.com/player/123456');
  });

  test('a Dailymotion slot embeds the video and does not autoplay it', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, DAILYMOTION_STORY_ID);

    await expect(slotAt(root).locator('iframe')).toHaveAttribute(
      'src',
      'https://www.dailymotion.com/embed/video/x84sh87?autoplay=0',
    );
  });

  test('a Dailymotion slot carries no start offset unless it is given one', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, DAILYMOTION_STORY_ID);

    const src = await slotAt(root).locator('iframe').getAttribute('src');

    expect(new URL(src ?? '').searchParams.get('start')).toBeNull();
  });

  test('a TikTok slot embeds the video without related content', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, TIKTOK_STORY_ID);

    await expect(slotAt(root).locator('iframe')).toHaveAttribute(
      'src',
      'https://www.tiktok.com/player/v1/6718335390845095173?rel=0',
    );
  });

  const TITLED_PLATFORMS = [
    { story: KICK_STORY_ID, title: 'Kick player' },
    { story: SOOP_STORY_ID, title: 'SOOP player' },
    { story: DAILYMOTION_STORY_ID, title: 'Dailymotion player' },
    { story: TIKTOK_STORY_ID, title: 'TikTok player' },
  ] as const;

  for (const { story, title } of TITLED_PLATFORMS) {
    test(`the iframe the library builds itself is titled "${title}"`, async ({ page }) => {
      await blockThirdParty(page);
      const root = await openStory(page, story);

      await expect(slotAt(root).locator('iframe')).toHaveAttribute('title', title);
      await expect(slotAt(root).getByTitle(title)).toHaveCount(1);
    });

    test(`the ${title} iframe allows autoplay, encrypted media and fullscreen`, async ({ page }) => {
      await blockThirdParty(page);
      const root = await openStory(page, story);
      const iframe = slotAt(root).locator('iframe');

      await expect(iframe).toHaveAttribute('allow', /autoplay/);
      await expect(iframe).toHaveAttribute('allow', /encrypted-media/);
      await expect(iframe).toHaveAttribute('allowfullscreen', '');
      await expect(iframe).toHaveAttribute('scrolling', 'no');
    });
  }

  test('a library-built iframe fills its slot and loads eagerly', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, KICK_STORY_ID);
    const slot = slotAt(root);
    const iframe = slot.locator('iframe');

    await expect(iframe).toHaveAttribute('width', '100%');
    await expect(iframe).toHaveAttribute('height', '100%');
    await expect(iframe).not.toHaveAttribute('loading', /.*/);

    const slotBox = await slot.boundingBox();
    const iframeBox = await iframe.boundingBox();

    expect(iframeBox?.width).toBeCloseTo(slotBox?.width ?? 0, 0);
    expect(iframeBox?.height).toBeCloseTo(slotBox?.height ?? 0, 0);
  });

  test('a YouTube slot hands the SDK the video id, the page origin and no related videos', async ({ page }) => {
    await stubPlatformSdks(page);
    await openStory(page, YOUTUBE_STORY_ID);

    const embeds = await page.evaluate(() => (window as StubWindow).__etYoutubeEmbeds ?? []);

    expect(embeds).toHaveLength(1);
    expect(embeds[0]?.videoId).toBe('dQw4w9WgXcQ');
    expect(embeds[0]?.width).toBe('100%');
    expect(embeds[0]?.height).toBe('100%');
    expect(embeds[0]?.playerVars).toMatchObject({ enablejsapi: 1, rel: 0, origin: 'http://localhost:4401' });
    expect(embeds[0]?.playerVars['start']).toBeUndefined();
  });

  test('a YouTube slot embeds the live video id it is bound to', async ({ page }) => {
    await stubPlatformSdks(page);
    await openStory(page, YOUTUBE_LIVE_STORY_ID);

    const embeds = await page.evaluate(() => (window as StubWindow).__etYoutubeEmbeds ?? []);

    expect(embeds[0]?.videoId).toBe('jfKfPfyJRdk');
  });

  test('a Twitch slot embeds a live channel when its src names one', async ({ page }) => {
    await stubPlatformSdks(page);
    await openStory(page, TWITCH_CHANNEL_STORY_ID);

    const embeds = await page.evaluate(() => (window as StubWindow).__etTwitchEmbeds ?? []);

    expect(embeds).toHaveLength(1);
    expect(embeds[0]?.channel).toBe('lofigirl');
    expect(embeds[0]?.video).toBeUndefined();
    expect(embeds[0]?.parent).toEqual(['localhost']);
    expect(embeds[0]?.layout).toBe('video');
  });

  test('a Twitch slot embeds a VOD when its src is a video URL', async ({ page }) => {
    await stubPlatformSdks(page);
    await openStory(page, TWITCH_VOD_STORY_ID);

    const embeds = await page.evaluate(() => (window as StubWindow).__etTwitchEmbeds ?? []);

    expect(embeds).toHaveLength(1);
    expect(embeds[0]?.video).toBe('2171815993');
    expect(embeds[0]?.channel).toBeUndefined();
  });

  test('a Twitch slot forwards its autoplay input to the embed', async ({ page }) => {
    await stubPlatformSdks(page);
    await openStory(page, TWITCH_CHANNEL_STORY_ID);

    const defaults = await page.evaluate(() => (window as StubWindow).__etTwitchEmbeds ?? []);

    expect(defaults[0]?.autoplay).toBe(false);

    await openStory(page, TWITCH_CHANNEL_STORY_ID, { args: { autoplay: true } });

    const autoplaying = await page.evaluate(() => (window as StubWindow).__etTwitchEmbeds ?? []);

    expect(autoplaying[0]?.autoplay).toBe(true);
  });

  test('a Vimeo slot hands the SDK the video id and a responsive player', async ({ page }) => {
    await stubPlatformSdks(page);
    await openStory(page, VIMEO_STORY_ID);

    const embeds = await page.evaluate(() => (window as StubWindow).__etVimeoEmbeds ?? []);

    expect(embeds).toHaveLength(1);
    expect(embeds[0]?.id).toBe(148751763);
    expect(embeds[0]?.responsive).toBe(true);
  });

  test('a Facebook slot builds the video container the SDK parses', async ({ page }) => {
    await stubPlatformSdks(page);
    const root = await openStory(page, FACEBOOK_STORY_ID);
    const container = root.locator(FACEBOOK_CONTAINER);

    await expect(container).toHaveAttribute('data-href', 'https://www.facebook.com/video/10155364627206729');
    await expect(container).toHaveAttribute('data-show-text', 'false');

    const parses = await page.evaluate(() => (window as StubWindow).__etFacebookParses ?? 0);

    expect(parses).toBe(1);
  });

  test('a slot whose SDK cannot load announces the failure and offers a retry', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, YOUTUBE_STORY_ID);
    const failure = slotAt(root).locator(ERROR);

    await expect(failure).toHaveAttribute('role', 'alert');
    await expect(failure.locator('h3')).toHaveText('Playback failed');
    await expect(failure.locator('p')).toHaveText(
      'The player could not be loaded. Please check your connection or try again.',
    );
    await expect(failure.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(slotAt(root).locator(LOADING)).toHaveCount(0);
  });

  test('retry asks the platform for another attempt', async ({ page }) => {
    await blockThirdParty(page);
    let attempts = 0;

    page.on('request', (request) => {
      attempts += request.url() === YT_API_URL ? 1 : 0;
    });

    const root = await openStory(page, YOUTUBE_STORY_ID);
    const failure = slotAt(root).locator(ERROR);

    await expect(failure).toBeVisible();
    expect(attempts).toBe(1);

    await failure.getByRole('button', { name: 'Retry' }).click();

    await expect.poll(() => attempts).toBe(2);
    await expect(slotAt(root).locator(ERROR)).toBeVisible();
  });

  test('a slot announces that it is loading while its SDK is still pending', async ({ page }) => {
    await page.route('**/*', (route) => {
      const url = route.request().url();

      if (isFirstParty(url)) return route.continue();

      return url === YT_API_URL ? undefined : route.abort();
    });

    const root = await openStory(page, YOUTUBE_STORY_ID);
    const loading = slotAt(root).locator(LOADING);

    await expect(loading).toHaveAttribute('role', 'status');
    await expect(loading).toHaveAttribute('aria-label', 'Loading');
    await expect(loading.locator('et-spinner')).toBeVisible();
    await expect(slotAt(root).locator(ERROR)).toHaveCount(0);
  });

  test('a consent gate holds the player back until it is accepted', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, YOUTUBE_CONSENT_STORY_ID);
    const gate = slotAt(root).locator(CONSENT);

    await expect(gate).toHaveAttribute('role', 'group');
    await expect(gate.locator('h3')).toHaveText('Content blocked');
    await expect(gate.locator('p')).toHaveText(
      'Playback requires your consent. Third-party cookies and data may be used.',
    );
    await expect(gate.getByRole('button', { name: 'Allow and play' })).toBeVisible();
    await expect(root.locator('et-youtube-player')).toHaveCount(0);

    await expect(gate).toHaveAttribute('aria-labelledby', /.+/);
    await expect(gate).toHaveAccessibleName('Content blocked');
  });

  test('accepting the consent gate replaces it with the player', async ({ page }) => {
    await stubPlatformSdks(page);
    const root = await openStory(page, YOUTUBE_CONSENT_STORY_ID);

    await slotAt(root).locator(CONSENT).getByRole('button', { name: 'Allow and play' }).click();

    await expect(slotAt(root).locator(CONSENT)).toHaveCount(0);
    await expect(root.locator('et-youtube-player')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => (window as StubWindow).__etYoutubeEmbeds?.length ?? 0)).toBe(1);
  });

  test('a slot without a configured consent component plays without a gate', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, YOUTUBE_STORY_ID);

    await expect(root.locator(CONSENT)).toHaveCount(0);
    await expect(root.locator('et-youtube-player')).toHaveCount(1);
  });

  test('a slot is a clipped, rounded, positioned box that keeps the player aspect ratio', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, KICK_STORY_ID);
    const slot = slotAt(root);

    const box = await slot.evaluate((el) => {
      const style = getComputedStyle(el);

      return {
        display: style.display,
        position: style.position,
        overflow: style.overflow,
        borderRadius: style.borderRadius,
      };
    });

    expect(box.display).toBe('block');
    expect(box.position).toBe('relative');
    expect(box.overflow).toBe('hidden');
    expect(box.borderRadius).toBe('12px');
    expect(await readAspectRatio(slot)).toBeCloseTo(16 / 9, 2);
  });

  test('a TikTok slot keeps the portrait aspect ratio of its player', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, TIKTOK_STORY_ID);

    expect(await readAspectRatio(slotAt(root))).toBeCloseTo(9 / 16, 2);
  });

  test('the mixed story keeps one independent player per slot', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, MIXED_STORY_ID);

    await expect(root.locator(SLOT)).toHaveCount(4);
    await expect(root.locator('.et-youtube-player-slot')).toHaveCount(1);
    await expect(root.locator('.et-twitch-player-slot')).toHaveCount(1);
    await expect(root.locator('.et-tiktok-player-slot')).toHaveCount(2);

    const tiktokSources = await root
      .locator('.et-tiktok-player-slot iframe')
      .evaluateAll((embeds) => embeds.map((embed) => embed.getAttribute('src')));

    expect(new Set(tiktokSources).size).toBe(2);
    expect(await readAspectRatio(slotAt(root))).toBeCloseTo(16 / 9, 2);
  });

  test('a slot adds no tab stop, role or label of its own', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, KICK_STORY_ID);
    const slot = slotAt(root);

    await expect(slot).not.toHaveAttribute('tabindex', /.*/);
    await expect(slot).not.toHaveAttribute('role', /.*/);
    await expect(slot).not.toHaveAttribute('aria-label', /.*/);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('IFRAME');
  });

  test('a failure overlay puts its retry in the tab order instead of the player', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, YOUTUBE_STORY_ID);

    await expect(slotAt(root).locator(ERROR)).toBeVisible();

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BUTTON');
    expect(sequence[0]?.text).toBe('Retry');
  });
});

test.describe('stream / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('a slot renders its player on a coarse pointer', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, KICK_STORY_ID);

    await expectTouchMode(page);
    await expect(slotAt(root).locator('iframe')).toHaveAttribute(
      'src',
      'https://player.kick.com/asmongold247?parent=localhost',
    );
  });

  test('a landscape slot keeps its aspect ratio inside a phone viewport', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, KICK_STORY_ID);
    const slot = slotAt(root);

    expect(await readAspectRatio(slot)).toBeCloseTo(16 / 9, 2);

    const viewport = page.viewportSize();
    const box = await slot.boundingBox();

    expect(box?.width).toBeLessThanOrEqual(viewport?.width ?? 0);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );

    expect(overflows).toBe(false);
  });

  test('a portrait slot keeps its aspect ratio inside a phone viewport', async ({ page }) => {
    await blockThirdParty(page);
    const root = await openStory(page, TIKTOK_STORY_ID);

    expect(await readAspectRatio(slotAt(root))).toBeCloseTo(9 / 16, 2);
  });

  test('the consent gate is accepted by tapping it', async ({ page }) => {
    await stubPlatformSdks(page);
    const root = await openStory(page, YOUTUBE_CONSENT_STORY_ID);
    const accept = slotAt(root).locator(CONSENT).getByRole('button', { name: 'Allow and play' });

    await expect(accept).toBeVisible();
    await tap(accept);

    await expect(slotAt(root).locator(CONSENT)).toHaveCount(0);
    await expect(root.locator('et-youtube-player')).toHaveCount(1);
  });

  test('the failure overlay retries on a tap', async ({ page }) => {
    await blockThirdParty(page);
    let attempts = 0;

    page.on('request', (request) => {
      attempts += request.url() === YT_API_URL ? 1 : 0;
    });

    const root = await openStory(page, YOUTUBE_STORY_ID);
    const retry = slotAt(root).locator(ERROR).getByRole('button', { name: 'Retry' });

    await expect(retry).toBeVisible();
    await tap(retry);

    await expect.poll(() => attempts).toBe(2);
    await expect(slotAt(root).locator(ERROR)).toBeVisible();
  });
});
