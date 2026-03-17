import { StreamConsentAcceptDirective } from './consent/stream-consent-accept.directive';
import { StreamConsentContentDirective } from './consent/stream-consent-content.directive';
import { StreamConsentPlaceholderDirective } from './consent/stream-consent-placeholder.directive';
import { StreamConsentComponent } from './consent/stream-consent.component';
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
import { YoutubePlayerComponent } from './platform/youtube/youtube-player.component';
import { YoutubePlayerDirective } from './platform/youtube/youtube-player.directive';

export const StreamImports = [
  StreamConsentComponent,
  StreamConsentContentDirective,
  StreamConsentPlaceholderDirective,
  StreamConsentAcceptDirective,
  YoutubePlayerComponent,
  YoutubePlayerDirective,
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
] as const;
