import { StreamConsentAcceptDirective } from './consent/headless/stream-consent-accept.directive';
import { StreamConsentComponent } from './consent/stream-consent.component';
import { StreamPlayerErrorComponent } from './error/stream-player-error.component';
import { StreamPlayerErrorDirective } from './error/headless/stream-player-error.directive';
import { StreamPlayerLoadingComponent } from './loading/stream-player-loading.component';
import { PipBackDirective } from './pip/headless/pip-back.directive';
import { PipBringBackDirective } from './pip/headless/pip-bring-back.directive';
import { PipCloseDirective } from './pip/headless/pip-close.directive';
import { PipGridToggleDirective } from './pip/headless/pip-grid-toggle.directive';
import { PipPlayerComponent } from './pip/pip-player.component';
import { PipWindowComponent } from './pip/pip-window.component';
import { DailymotionPlayerSlotComponent } from './platform/dailymotion/dailymotion-player-slot.component';
import { DailymotionPlayerComponent } from './platform/dailymotion/dailymotion-player.component';
import { FacebookPlayerSlotComponent } from './platform/facebook/facebook-player-slot.component';
import { FacebookPlayerComponent } from './platform/facebook/facebook-player.component';
import { KickPlayerSlotComponent } from './platform/kick/kick-player-slot.component';
import { KickPlayerComponent } from './platform/kick/kick-player.component';
import { SoopPlayerSlotComponent } from './platform/soop/soop-player-slot.component';
import { SoopPlayerComponent } from './platform/soop/soop-player.component';
import { TikTokPlayerSlotComponent } from './platform/tiktok/tiktok-player-slot.component';
import { TikTokPlayerComponent } from './platform/tiktok/tiktok-player.component';
import { TwitchPlayerSlotComponent } from './platform/twitch/twitch-player-slot.component';
import { TwitchPlayerComponent } from './platform/twitch/twitch-player.component';
import { VimeoPlayerSlotComponent } from './platform/vimeo/vimeo-player-slot.component';
import { VimeoPlayerComponent } from './platform/vimeo/vimeo-player.component';
import { YoutubePlayerSlotComponent } from './platform/youtube/youtube-player-slot.component';
import { YoutubePlayerComponent } from './platform/youtube/youtube-player.component';

/**
 * The parts every stream shares: the consent gate and the loading and error overlays. Deliberately lean -
 * add the barrel of each platform you actually embed (e.g. {@link STREAM_YOUTUBE_IMPORTS}), so the seven
 * you don't stay out of your bundle.
 */
export const STREAM_IMPORTS = [
  StreamConsentComponent,
  StreamConsentAcceptDirective,
  StreamPlayerLoadingComponent,
  StreamPlayerErrorComponent,
  StreamPlayerErrorDirective,
] as const;

/** The YouTube player and its player slot. */
export const STREAM_YOUTUBE_IMPORTS = [YoutubePlayerComponent, YoutubePlayerSlotComponent] as const;

/** The Twitch player and its player slot. */
export const STREAM_TWITCH_IMPORTS = [TwitchPlayerComponent, TwitchPlayerSlotComponent] as const;

/** The Vimeo player and its player slot. */
export const STREAM_VIMEO_IMPORTS = [VimeoPlayerComponent, VimeoPlayerSlotComponent] as const;

/** The Dailymotion player and its player slot. */
export const STREAM_DAILYMOTION_IMPORTS = [DailymotionPlayerComponent, DailymotionPlayerSlotComponent] as const;

/** The Kick player and its player slot. */
export const STREAM_KICK_IMPORTS = [KickPlayerComponent, KickPlayerSlotComponent] as const;

/** The Facebook player and its player slot. */
export const STREAM_FACEBOOK_IMPORTS = [FacebookPlayerComponent, FacebookPlayerSlotComponent] as const;

/** The TikTok player and its player slot. */
export const STREAM_TIKTOK_IMPORTS = [TikTokPlayerComponent, TikTokPlayerSlotComponent] as const;

/** The SOOP player and its player slot. */
export const STREAM_SOOP_IMPORTS = [SoopPlayerComponent, SoopPlayerSlotComponent] as const;

/**
 * Picture-in-picture: the floating window, the PiP player and the `etPipClose` / `etPipBack` /
 * `etPipBringBack` / `etPipGridToggle` controls. Pulls in the draggable, resizable window chrome, so it
 * is separate from the players themselves.
 */
export const STREAM_PIP_IMPORTS = [
  PipWindowComponent,
  PipPlayerComponent,
  PipCloseDirective,
  PipBackDirective,
  PipBringBackDirective,
  PipGridToggleDirective,
] as const;

/**
 * Everything the stream domain has: the shared parts, all eight platforms and picture-in-picture. Handy
 * for a playground; in an app, import only the platforms you actually embed.
 */
export const STREAM_ALL_IMPORTS = [
  STREAM_IMPORTS,
  STREAM_YOUTUBE_IMPORTS,
  STREAM_TWITCH_IMPORTS,
  STREAM_VIMEO_IMPORTS,
  STREAM_DAILYMOTION_IMPORTS,
  STREAM_KICK_IMPORTS,
  STREAM_FACEBOOK_IMPORTS,
  STREAM_TIKTOK_IMPORTS,
  STREAM_SOOP_IMPORTS,
  STREAM_PIP_IMPORTS,
] as const;
