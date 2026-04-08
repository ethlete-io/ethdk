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
import { DailymotionPlayerDirective } from './platform/dailymotion/headless/dailymotion-player.directive';
import { FacebookPlayerSlotComponent } from './platform/facebook/facebook-player-slot.component';
import { FacebookPlayerComponent } from './platform/facebook/facebook-player.component';
import { FacebookPlayerDirective } from './platform/facebook/headless/facebook-player.directive';
import { KickPlayerSlotComponent } from './platform/kick/kick-player-slot.component';
import { KickPlayerComponent } from './platform/kick/kick-player.component';
import { KickPlayerDirective } from './platform/kick/headless/kick-player.directive';
import { SoopPlayerSlotComponent } from './platform/soop/soop-player-slot.component';
import { SoopPlayerComponent } from './platform/soop/soop-player.component';
import { SoopPlayerDirective } from './platform/soop/headless/soop-player.directive';
import { TikTokPlayerSlotComponent } from './platform/tiktok/tiktok-player-slot.component';
import { TikTokPlayerComponent } from './platform/tiktok/tiktok-player.component';
import { TikTokPlayerDirective } from './platform/tiktok/headless/tiktok-player.directive';
import { TwitchPlayerSlotComponent } from './platform/twitch/twitch-player-slot.component';
import { TwitchPlayerComponent } from './platform/twitch/twitch-player.component';
import { TwitchPlayerDirective } from './platform/twitch/headless/twitch-player.directive';
import { VimeoPlayerSlotComponent } from './platform/vimeo/vimeo-player-slot.component';
import { VimeoPlayerComponent } from './platform/vimeo/vimeo-player.component';
import { VimeoPlayerDirective } from './platform/vimeo/headless/vimeo-player.directive';
import { YoutubePlayerParamsDirective } from './platform/youtube/headless/youtube-player-params.directive';
import { YoutubePlayerSlotComponent } from './platform/youtube/youtube-player-slot.component';
import { YoutubePlayerComponent } from './platform/youtube/youtube-player.component';
import { YoutubePlayerDirective } from './platform/youtube/headless/youtube-player.directive';
import { StreamPlayerSlotDirective } from './stream-player-slot.directive';

export const StreamImports = [
  StreamConsentComponent,
  StreamConsentAcceptDirective,
  StreamPlayerLoadingComponent,
  StreamPlayerErrorComponent,
  StreamPlayerErrorDirective,
  YoutubePlayerComponent,
  YoutubePlayerDirective,
  YoutubePlayerParamsDirective,
  YoutubePlayerSlotComponent,
  StreamPlayerSlotDirective,
  TwitchPlayerComponent,
  TwitchPlayerDirective,
  TwitchPlayerSlotComponent,
  VimeoPlayerComponent,
  VimeoPlayerDirective,
  VimeoPlayerSlotComponent,
  DailymotionPlayerComponent,
  DailymotionPlayerDirective,
  DailymotionPlayerSlotComponent,
  KickPlayerComponent,
  KickPlayerDirective,
  KickPlayerSlotComponent,
  FacebookPlayerComponent,
  FacebookPlayerDirective,
  FacebookPlayerSlotComponent,
  TikTokPlayerComponent,
  TikTokPlayerDirective,
  TikTokPlayerSlotComponent,
  SoopPlayerComponent,
  SoopPlayerDirective,
  SoopPlayerSlotComponent,
  PipWindowComponent,
  PipPlayerComponent,
  PipCloseDirective,
  PipBackDirective,
  PipBringBackDirective,
  PipGridToggleDirective,
] as const;
