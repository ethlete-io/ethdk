# Stream

Embedded live-stream and video players for **YouTube, Twitch, Vimeo, Dailymotion, Kick, Facebook, TikTok and SOOP** — with consent gating, loading/error overlays and cross-slot picture-in-picture. Import `StreamImports`.

## Player slots

Each platform ships a raw player (`et-youtube-player`) and a **slot** (`et-youtube-player-slot`) — use the slot: it wraps the player with consent, loading and error handling plus PiP support. You size the box via CSS:

```html
<et-youtube-player-slot [videoId]="'dQw4w9WgXcQ'" class="block w-full max-w-4xl aspect-video" />
<et-twitch-player-slot class="block aspect-video" src="lofigirl" />
<et-tiktok-player-slot [videoId]="id()" class="block aspect-9/16" />
```

Source inputs per platform:

| Platform    | Source                                                       | Extras                          |
| ----------- | ------------------------------------------------------------ | ------------------------------- |
| YouTube     | `videoId`                                                    | `startTime`                     |
| Twitch      | `src` — channel name, channel URL or `…/videos/<id>` VOD URL | `autoplay`, `chat`, `startTime` |
| Vimeo       | `videoId`                                                    | `startTime`                     |
| Dailymotion | `videoId`                                                    | `startTime`                     |
| Kick        | `channel`                                                    | `muted`                         |
| Facebook    | `videoId`                                                    | —                               |
| TikTok      | `videoId`                                                    | portrait 9∶16 by default        |
| SOOP        | `userId` or `videoId`                                        | —                               |

Every slot additionally accepts `width` / `height` (iframe sizing — usually leave them alone and size via CSS), `streamSlotPriority` (when several slots want the same player id, a priority slot wins the player) and `streamSlotOnPipBack` (declarative PiP-return callback, the template-friendly alternative to `pipActivate(onBack)`).

## Live demo

<StoryEmbed id="components-stream-youtube--default" height="480px" />

## Player state & control

Every player implements the shared `StreamPlayer` interface: a `state` signal (`isReady`, `isLoading`, `isPlaying`, `isMuted`, `isEnded`, `currentTime`, `duration` — `null` for live streams, `error`) and `play()` / `pause()` / `mute()` / `unmute()` / `seek(seconds)` / `retry()`. From a slot, read state via `slot.slotDirective.slot.currentState()`.

Not every platform supports every control — each player exposes a static `CAPABILITIES` (`canPlay`, `canPause`, `canMute`, `canSeek`, `canGetDuration`, `isLiveCapable`, `hasThumbnail`). Methods without the capability are no-ops, so check it to decide which controls to render.

## Consent gating

Configure a consent component globally and every slot renders it as a gate until the viewer accepts (or wire your CMP through the `STREAM_USER_CONSENT_PROVIDER_TOKEN`):

```ts
provideStreamConfig({
  consentComponent: StreamConsentComponent, // the built-in gate, or your own [etStreamConsent] component
});
```

The built-in `et-stream-consent` shows a lock icon, heading/description and an accept button; texts are configurable via `provideStreamConsentConfig`. Loading (`et-stream-player-loading`) and error (`et-stream-player-error`, with retry) overlays are equally replaceable via `provideStreamConfig`.

## Picture-in-picture

A slot's player can detach into a floating, draggable PiP window and hand back later — even across different slots (the player instance is transferred, playback uninterrupted):

```html
<et-youtube-player-slot #slot [videoId]="videoId()" class="aspect-video" />
<button (click)="slot.slotDirective.slot.pipActivate(() => goBackToThisView())" et-button>Enter PiP</button>
```

`pipActivate(onBack?)` / `pipDeactivate()` control it; the PiP window chrome (close, back, grid toggle for multiple simultaneous PiP players) and window sizing are configurable via `provideStreamConfig({ pipChromeComponent, pipChrome, pipWindow, pipSlotPlaceholderComponent })` — `pipChrome` tunes the appearance of the built-in chrome without replacing it. The `Mixed` story demonstrates a PiP grid mixing 16∶9 and 9∶16 players.

<StoryEmbed id="components-stream-mixed--mixed-aspect-ratios" height="560px" />

## Accessibility

- The PiP chrome is fully operable: its focus/close/grid-toggle buttons carry `aria-label`s, and in grid mode each cell is a keyboard-activatable `role="button"` (<kbd>Enter</kbd>/<kbd>Space</kbd> selects the featured player).
- The built-in overlays carry live-region semantics: the loading overlay is a `role="status"` region labelled "Loading", the error overlay announces via `role="alert"`, and the consent gate is a `role="group"` labelled by its heading. Custom replacements (via `provideStreamConfig`) should provide equivalents.
- Iframes the library creates itself (Kick, SOOP, Dailymotion, TikTok) carry a descriptive `title`. The YouTube, Vimeo, Twitch and Facebook iframes are created by the platform SDKs and can't be titled from here — give those slots surrounding context (e.g. a heading).

## Theming

All stream chrome resolves its colors from the surface/color theme systems. Slots provide a `type: 'dark'` surface scope one elevation above their context (video UI always reads as a dark surface), and the PiP chrome — which mounts into `document.body` — provides the same scope itself.

- Slot: `--et-stream-player-slot-radius` (`12px`).
- PiP window: `--et-pip-border-radius` (`8px`), `--et-pip-backdrop-blur` (`4px`), `--et-pip-title-bar-height` (`32px`), plus `--et-pip-slot-placeholder-*` (gap, padding, icon-size, border-radius, message typography) for the placeholder left behind. The glass background derives from the surface theme; override it via `--et-pip-bg`.
- PiP grid: the featured-cell ring uses the color theme's primary; override via `--et-stream-pip-chrome-featured-ring-color`.
- Consent gate and error overlay: `--et-stream-consent-*` and `--et-stream-player-error-*` families covering padding, gap, icon size, border radius and heading/description typography.

## Error codes

Consent/PiP wiring problems and platform SDK failures throw [`ET16xx` errors](/components/error-codes#stream-et16xx) — the SDK/loading failures also in production.
