# Stream

Embedded live-stream and video players for **YouTube, Twitch, Vimeo, Dailymotion, Kick, Facebook, TikTok and SOOP** - with consent gating, loading/error overlays and cross-slot picture-in-picture. Import `STREAM_IMPORTS` plus the barrel of each platform you embed.

## Player slots

Each platform ships a raw player (`et-youtube-player`) and a **slot** (`et-youtube-player-slot`) - use the slot: it wraps the player with consent, loading and error handling plus PiP support. You size the box via CSS:

```html
<et-youtube-player-slot [videoId]="'dQw4w9WgXcQ'" class="block w-full max-w-4xl aspect-video" />
<et-twitch-player-slot class="block aspect-video" src="lofigirl" />
<et-tiktok-player-slot [videoId]="id()" class="block aspect-9/16" />
```

```ts
// the shared parts, then one barrel per platform you actually embed
import {
  provideStreamPip,
  STREAM_IMPORTS,
  STREAM_TIKTOK_IMPORTS,
  STREAM_TWITCH_IMPORTS,
  STREAM_YOUTUBE_IMPORTS,
} from '@ethlete/components';
```

`STREAM_IMPORTS` holds only what every stream shares - the consent gate and the error overlay
directive. The shipped loading and error overlays are not in it (see [below](#loading-and-error-overlays-are-opt-in)). Each platform ships its own barrel, so the seven you don't use stay out of your bundle:

| Platform    | Barrel                       |
| ----------- | ---------------------------- |
| YouTube     | `STREAM_YOUTUBE_IMPORTS`     |
| Twitch      | `STREAM_TWITCH_IMPORTS`      |
| Vimeo       | `STREAM_VIMEO_IMPORTS`       |
| Dailymotion | `STREAM_DAILYMOTION_IMPORTS` |
| Kick        | `STREAM_KICK_IMPORTS`        |
| Facebook    | `STREAM_FACEBOOK_IMPORTS`    |
| TikTok      | `STREAM_TIKTOK_IMPORTS`      |
| SOOP        | `STREAM_SOOP_IMPORTS`        |

Picture-in-picture needs both `STREAM_PIP_IMPORTS` and `provideStreamPip()`; `STREAM_ALL_IMPORTS` is
everything at once - handy in a playground, wasteful in an app.

Source inputs per platform:

| Platform    | Source                                                       | Extras                              |
| ----------- | ------------------------------------------------------------ | ----------------------------------- |
| YouTube     | `videoId`                                                    | `startTime`                         |
| Twitch      | `src` - channel name, channel URL or `…/videos/<id>` VOD URL | `autoplay`, `chat`, `startTime`     |
| Vimeo       | `videoId`                                                    | `startTime`                         |
| Dailymotion | `videoId`                                                    | `startTime`                         |
| Kick        | `channel`                                                    | `muted`                             |
| Facebook    | `videoId`                                                    | -                                   |
| TikTok      | `videoId`                                                    | portrait 9∶16 in picture-in-picture |
| SOOP        | `userId` or `videoId`                                        | -                                   |

Every slot additionally accepts `width` / `height` (iframe sizing - usually leave them alone and size via CSS), `streamSlotPriority` (when several slots want the same player id, a priority slot wins the player) and `streamSlotOnPipBack` (declarative PiP-return callback, the template-friendly alternative to `pipActivate(onBack)`).

A SOOP slot with neither `userId` nor `videoId`, or a Twitch `src` that is no channel or video (`twitch.tv/videos/`, a clip URL), shows the error overlay and reports `ET1611` to the `ErrorHandler` in development. When both SOOP ids are set, `userId` wins.

Upgrading from a version that shipped `YoutubePlayerSlotDirective`? The migration drops it from
`imports` arrays and marks each other use - a host directive, an injected `YOUTUBE_PLAYER_SLOT_TOKEN` -
with a `TODO(ethlete-migration)` comment. Replace those with `<et-youtube-player-slot>` or
`createStreamPlayerSlot`:

```bash
yarn nx g @ethlete/components:migrate-youtube-player-slot-directive
```

Only a change of the source input creates a new embed. The extras, `width` and `height` are read when the embed is created, so changing them later has no effect until the source changes or the player is retried.

## Live demo

<StoryEmbed id="components-media-stream-youtube--default" height="480px" />

## Player state & control

Every player implements the shared `StreamPlayer` interface: a `state` signal (`isReady`, `isLoading`, `isPlaying`, `isMuted`, `isEnded`, `currentTime` - `null` for live streams, `duration` - `null` until known, `error`) and `play()` / `pause()` / `mute()` / `unmute()` / `seek(seconds)` / `retry()`.

Not every platform supports every control - each player exposes a `CAPABILITIES` object (`canPlay`, `canPause`, `canMute`, `canSeek`, `canGetDuration`, `isLiveCapable`, `hasThumbnail`). Methods without the capability are no-ops, so check it to decide which controls to render.

| Platform                | play / pause / mute / seek |
| ----------------------- | -------------------------- |
| YouTube, Twitch, Vimeo  | yes                        |
| Facebook, TikTok        | yes (no live streams)      |
| Kick, SOOP, Dailymotion | no - plain iframe embeds   |

A slot exposes the same controls for whatever player it holds, on `slot.controls` (or `injectStreamPlayerSlot()` from content projected into the slot): `currentPlayerId()` (read-only), `currentState()`, `capabilities()`, and `play()` / `pause()` / `mute()` / `unmute()` / `seek(seconds)`. Each control returns `true` when the command reached the player and `false` when it could not - the slot has no player yet (consent gate still up), the player is not ready, or the platform lacks the capability. `capabilities()` is `NO_STREAM_PLAYER_CAPABILITIES` (all `false`) until the player exists. A second slot bound to the same player id controls that same player.

```ts
@Component({
  selector: 'app-play-toggle',
  template: `
    @if (slot.capabilities().canPause) {
      <button (click)="toggle()" et-button>{{ slot.currentState().isPlaying ? 'Pause' : 'Play' }}</button>
    }
  `,
})
export class PlayToggleComponent {
  protected slot = injectStreamPlayerSlot();

  protected toggle() {
    if (this.slot.currentState().isPlaying) this.slot.pause();
    else this.slot.play();
  }
}
```

```html
<et-youtube-player-slot [videoId]="videoId()">
  <app-play-toggle />
</et-youtube-player-slot>
```

<StoryEmbed id="components-media-stream-youtube--slot-controls" height="640px" />

## Consent gating

Configure a consent component globally and every slot renders it as a gate until the viewer accepts (or wire your CMP through the `STREAM_USER_CONSENT_PROVIDER_TOKEN` - a `ConsentHandler` bound via [`createUserConsentProvider`](/core/providers#user-consent)):

```ts
import { StreamConsentComponent, provideStreamConfig } from '@ethlete/components';

provideStreamConfig({
  consentComponent: StreamConsentComponent, // the built-in gate, or your own [etStreamConsent] component
});
```

The built-in `et-stream-consent` shows a lock icon, heading/description and an accept button; texts are configurable via `provideStreamLabels` and react to the app [locale](/core/providers#locale); `provideStreamConsentConfig` keeps only the accept button's color. Loading (`et-stream-player-loading`) and error (`et-stream-player-error`, with retry) overlays are equally replaceable via `provideStreamConfig`.

### Loading and error overlays are opt-in

`provideStreamConfig` defaults `loadingComponent` and `errorComponent` to `null`, so a slot draws no overlay while the player loads or fails, and an app that brings its own bundles neither shipped one. Spread `STREAM_DEFAULT_COMPONENTS` to register both:

```ts
import { provideStreamConfig, STREAM_DEFAULT_COMPONENTS } from '@ethlete/components';

provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS });
```

`et update` adds the spread to every literal `provideStreamConfig` call. In an app with no config, it adds `provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS })` to the application config, and it lists the stream slots when it finds no application config.

The overlays are no longer part of `STREAM_IMPORTS` either, so an app that renders `<et-stream-player-loading>` or `<et-stream-player-error>` in its own template imports `StreamPlayerLoadingComponent` or `StreamPlayerErrorComponent` itself; `et update` adds them. `STREAM_ALL_IMPORTS` still includes both.

Rebinding the slot to another video while the gate is still up is safe: accepting creates the player for the id the slot holds at that moment, not the one it held when the gate appeared.

Revoking consent through the `ConsentHandler` destroys every mounted player, ends its PiP, and puts the gate back up.

<StoryEmbed id="components-media-stream-youtube--consent-provider" height="560px" />

When several slots share a player, rebinding one of them to another id gives that slot its own player and leaves the others playing. The loading and error overlays show in whichever slot currently holds the player.

## Picture-in-picture

A slot's player can detach into a floating, draggable PiP window and hand back later - even across different slots (the player instance is transferred, playback uninterrupted):

```html
<et-youtube-player-slot #slot [videoId]="videoId()" class="aspect-video" />
<button (click)="slot.controls.pipActivate(() => goBackToThisView())" et-button>Enter PiP</button>
```

`pipActivate(onBack?)` / `pipDeactivate()` control it, and return `false` when they could not: no
`provideStreamPip()` in scope, no player yet (consent gate still up), or the player is already in (or not in) PiP.
Register `provideStreamPip()` where the slots are provided, alongside `STREAM_PIP_IMPORTS`; without it, slots
still play normally, and a PiP call reports `ET1612` in development.
While the player floats, the slot it left shows a placeholder (a "playing in picture-in-picture" message with a back button). `provideStreamPip()` registers `PipSlotPlaceholderComponent` for it by default, whatever the order of the providers. Set `pipSlotPlaceholderComponent` in `provideStreamConfig()` to change that: `null` opts out and leaves the slot an empty box, a component replaces the default. Without `provideStreamPip()` no placeholder renders unless you set one:

```ts
provideStreamConfig({ pipSlotPlaceholderComponent: null });
provideStreamConfig({ pipSlotPlaceholderComponent: MyPipPlaceholderComponent });
```

Configure the PiP chrome and window through the PiP provider:

```ts
provideStreamPip({
  pipChromeComponent: MyPipChromeComponent,
  pipChrome: { controlsColor: 'neutral' },
  pipWindow: { desiredSize: 480 },
});
```

A custom chrome component composes the headless PiP directives from `STREAM_PIP_IMPORTS`: `etPipClose`,
`etPipBack`, `etPipBringBack` and `etPipGridToggle`. It must also implement `PipChromeRef` (a `state` and
an `animations` member) and provide itself under `PIP_CHROME_REF_TOKEN`, which is how the manager reaches
into it - a chrome without that provider throws `ET1604`:

```ts
@Component({
  providers: [{ provide: PIP_CHROME_REF_TOKEN, useExisting: MyPipChromeComponent }],
  // …
})
export class MyPipChromeComponent implements PipChromeRef {
  public state = createPipChromeState();
  public animations = createPipChromeAnimations(this.state, {/* … */});
}
```

The `CustomPipChrome` story builds this chrome from the headless directives and floats two players in it.

<StoryEmbed id="components-media-stream-youtube--custom-pip-chrome" height="640px" />

The `Mixed` story demonstrates a PiP grid mixing 16∶9 and 9∶16 players.

<StoryEmbed id="components-media-stream-mixed--mixed-aspect-ratios" height="560px" />

## Localization

Every string the built-in chrome renders comes from `STREAM_LABELS` - the consent gate's
heading/description/accept, the failure overlay's heading/description/retry, the PiP placeholder and
its back button, the PiP window's close, focus and grid-toggle controls and its title bar, the loading overlay's announcement, and
the `title` on iframes the library creates:

```ts
provideStreamLabels({
  consentHeading: 'Inhalt blockiert',
  consentAccept: 'Erlauben und abspielen',
  errorRetry: 'Erneut versuchen',
});
```

The `provideStreamConsentConfig` / `provideStreamPlayerErrorConfig` / `providePipSlotPlaceholderConfig`
tokens keep only their button colors. See the [localization guide](/components/localization).

## Accessibility

- The PiP chrome is fully operable: its focus/close/grid-toggle buttons carry `aria-label`s, and in grid mode each cell is a keyboard-activatable `role="button"` (<kbd>Enter</kbd>/<kbd>Space</kbd> selects the featured player).
- The PiP window's title bar is a tab stop (`role="group"`, labelled from `STREAM_LABELS.pipMove`). While it has focus, the arrow keys move the window 10px per press and stop at the viewport padding, <kbd>Shift</kbd>+arrow keys resize it by the same step (<kbd>Shift</kbd>+<kbd>ArrowRight</kbd>/<kbd>ArrowDown</kbd> grow it), within `minWidth`/`maxWidth` and the viewport and keeping the aspect ratio, and <kbd>Enter</kbd>/<kbd>Space</kbd> brings a window parked at the viewport edge back into view.
- The built-in overlays carry live-region semantics: the loading overlay is a `role="status"` region labelled from `STREAM_LABELS.loading`, the error overlay announces via `role="alert"`, and the consent gate is a `role="group"` labelled by its heading text. The heading text is a plain paragraph rather than an `<h3>`, so it never distorts the page's heading outline. Custom replacements (via `provideStreamConfig`) should provide equivalents.
- Iframes the library creates itself (Kick, SOOP, Dailymotion, TikTok) carry a descriptive `title` from `STREAM_LABELS.playerFrame`. The YouTube, Vimeo, Twitch and Facebook iframes are created by the platform SDKs and can't be titled from here - give those slots surrounding context (e.g. a heading).

## Theming

All stream chrome resolves its colors from the [surface/color theme systems](/core/theming). Slots provide a surface scope one elevation above their context, resolved against the ambient surface `type` - a slot on a light surface stays light. The PiP chrome is the exception: it mounts into `document.body`, outside any surface scope, so it resolves a `type: 'dark'` surface of its own (video UI floating over the page reads as dark).

- Slot: `--et-stream-player-slot-radius` (`12px`).
- PiP window: `--et-pip-border-radius` (`8px`), `--et-pip-backdrop-blur` (`4px`), `--et-pip-title-bar-height` (`32px`), plus `--et-pip-slot-placeholder-*` (gap, padding, icon-size, border-radius, message typography) for the placeholder left behind. These inherit, so a value set on `et-pip-window`, `et-pip-slot-placeholder` or any ancestor reaches the title bar, content and card that read it. The glass background derives from the surface theme; override it via `--et-pip-bg`.
- PiP placement: the window opens in the bottom right corner, `--et-pip-window-offset-right` and `--et-pip-window-offset-bottom` (`24px`) from the edges (reduced to the viewport padding where the window would not fit), at `--et-pip-window-z-index` (`1000`). Dragging takes over once it has opened. The body-level container that holds players between slots ships its own off-screen rule.
- PiP grid: the featured-cell ring uses the color theme's primary; override via `--et-stream-pip-chrome-featured-ring-color`.
- Consent gate and error overlay: `--et-stream-consent-*` and `--et-stream-player-error-*` families covering padding, gap, icon size, border radius and heading/description typography. They inherit, so a value set on the gate, the error overlay or any ancestor reaches the card that reads it.

## Content Security Policy

The YouTube, Vimeo, Twitch and Facebook players load their platform SDK as a `<script>` that carries Angular's `CSP_NONCE`. Each SDK then loads more script and creates its own iframe, so its origin is still needed in `script-src` (or `'strict-dynamic'`). The other players are plain iframes.

| Player      | `script-src`                   | `frame-src`                                               |
| ----------- | ------------------------------ | --------------------------------------------------------- |
| YouTube     | `https://www.youtube.com`      | `https://www.youtube.com`                                 |
| Vimeo       | `https://player.vimeo.com`     | `https://player.vimeo.com`                                |
| Twitch      | `https://embed.twitch.tv`      | `https://embed.twitch.tv`                                 |
| Facebook    | `https://connect.facebook.net` | `https://www.facebook.com`                                |
| Dailymotion | -                              | `https://www.dailymotion.com`                             |
| Kick        | -                              | `https://player.kick.com`                                 |
| TikTok      | -                              | `https://www.tiktok.com`                                  |
| SOOP        | -                              | `https://play.afreecatv.com`, `https://vod.afreecatv.com` |

The YouTube poster image comes from `https://img.youtube.com`.

## Facebook SDK locale and version

The Facebook player loads `https://connect.facebook.net/<locale>/sdk.js`. The locale follows the app [locale](/core/providers#locale) (`de` and `de-DE` become `de_DE`, an unparsable tag falls back to `en_US`) and is read when the SDK loads, once per page. The SDK version defaults to `v26.0`; pin another one via `provideStreamConfig`:

```ts
provideStreamConfig({ facebookSdkVersion: 'v25.0' });
```

## Error codes

Consent/PiP wiring problems and platform SDK failures throw [`ET16xx` errors](/components/error-codes#stream-et16xx) - the SDK/loading failures also in production.
