import { StreamConsentAcceptDirective } from './consent/stream-consent-accept.directive';
import { StreamConsentComponent } from './consent/stream-consent.component';
import { PipBackDirective } from './pip/pip-back.directive';
import { PipBringBackDirective } from './pip/pip-bring-back.directive';
import { StreamPipChromeComponent } from './pip/pip-chrome.component';
import { PipCloseDirective } from './pip/pip-close.directive';
import { PipGridToggleDirective } from './pip/pip-grid-toggle.directive';
import { PipPlayerComponent } from './pip/pip-player.component';
import { PipWindowComponent } from './pip/pip-window.component';
import { DailymotionPlayerComponent } from './platform/dailymotion/dailymotion-player.component';
import { DailymotionPlayerDirective } from './platform/dailymotion/dailymotion-player.directive';
import { FacebookPlayerComponent } from './platform/facebook/facebook-player.component';
import { FacebookPlayerDirective } from './platform/facebook/facebook-player.directive';
import { KickPlayerComponent } from './platform/kick/kick-player.component';
import { KickPlayerDirective } from './platform/kick/kick-player.directive';
import { SoopPlayerComponent } from './platform/soop/soop-player.component';
import { SoopPlayerDirective } from './platform/soop/soop-player.directive';
import { TikTokPlayerComponent } from './platform/tiktok/tiktok-player.component';
import { TikTokPlayerDirective } from './platform/tiktok/tiktok-player.directive';
import { TwitchPlayerComponent } from './platform/twitch/twitch-player.component';
import { TwitchPlayerDirective } from './platform/twitch/twitch-player.directive';
import { VimeoPlayerComponent } from './platform/vimeo/vimeo-player.component';
import { VimeoPlayerDirective } from './platform/vimeo/vimeo-player.directive';
import { YoutubePlayerParamsDirective } from './platform/youtube/youtube-player-params.directive';
import { YoutubePlayerSlotComponent } from './platform/youtube/youtube-player-slot.component';
import { YoutubePlayerSlotDirective } from './platform/youtube/youtube-player-slot.directive';
import { YoutubePlayerComponent } from './platform/youtube/youtube-player.component';
import { YoutubePlayerDirective } from './platform/youtube/youtube-player.directive';

export const StreamImports = [
  StreamConsentComponent,
  StreamConsentAcceptDirective,
  YoutubePlayerComponent,
  YoutubePlayerDirective,
  YoutubePlayerParamsDirective,
  YoutubePlayerSlotComponent,
  YoutubePlayerSlotDirective,
  TwitchPlayerComponent,
  TwitchPlayerDirective,
  VimeoPlayerComponent,
  VimeoPlayerDirective,
  DailymotionPlayerComponent,
  DailymotionPlayerDirective,
  KickPlayerComponent,
  KickPlayerDirective,
  FacebookPlayerComponent,
  FacebookPlayerDirective,
  TikTokPlayerComponent,
  TikTokPlayerDirective,
  SoopPlayerComponent,
  SoopPlayerDirective,
  StreamPipChromeComponent,
  PipWindowComponent,
  PipPlayerComponent,
  PipCloseDirective,
  PipBackDirective,
  PipBringBackDirective,
  PipGridToggleDirective,
] as const;
