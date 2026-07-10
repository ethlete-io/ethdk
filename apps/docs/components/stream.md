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

## Live demo

<StoryEmbed id="components-stream-youtube--default" height="480px" />

## Player state & control

Every player implements the shared `StreamPlayer` interface: a `state` signal (`isReady`, `isLoading`, `isPlaying`, `isMuted`, `isEnded`, `currentTime`, `duration` — `null` for live streams, `error`) and `play()` / `pause()` / `mute()` / `unmute()` / `seek(seconds)` / `retry()`. From a slot, read state via `slot.slotDirective.slot.currentState()`.

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

`pipActivate(onBack?)` / `pipDeactivate()` control it; the PiP window chrome (close, back, grid toggle for multiple simultaneous PiP players) and window sizing are configurable via `provideStreamConfig({ pipChromeComponent, pipWindow, pipSlotPlaceholderComponent })`. The `Mixed` story demonstrates a PiP grid mixing 16∶9 and 9∶16 players.

<StoryEmbed id="components-stream-mixed--mixed-aspect-ratios" height="560px" />
