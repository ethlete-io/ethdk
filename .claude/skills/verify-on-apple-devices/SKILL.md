---
name: verify-on-apple-devices
description: Drive the team Mac's iOS Simulator and the real iPad over LAN (SSH + safaridriver + idb) to verify a story on real Apple engines — touch media queries, soft keyboard, browser bar, vh/dvh, safe-area. Use when a change needs real iOS Safari behavior that headless Chromium or the local Android emulator can't provide.
---

# Verify a story on Apple devices over the local network

This Linux PC has no iOS tooling — but the team Mac (with Xcode simulators) and
a real iPad are reachable over LAN. Everything is driven through
`apple-remote.sh` in this directory. Escalation order stays: `verify-in-storybook`
(headless Chromium) → `verify-in-mobile-emulator` (Android/Playwright) → this
skill, for genuine iOS Safari behavior.

```bash
.claude/skills/verify-on-apple-devices/apple-remote.sh <command>
```

## Prerequisites (one-time, already done on this network)

- Mac: *Entfernte Anmeldung* (Remote Login) on; this PC's SSH key authorized.
  `~/.ssh/config` has a `Host ethlete-mac` alias (override: `ETHLETE_MAC_HOST`).
- Mac: `safaridriver --enable` run once (interactive, needs the user's password).
- Mac: `idb` for real taps/typing on simulators:
  `brew trust facebook/fb && brew install idb-companion` (Homebrew ≥ 6 requires
  the trust step) plus `pip3 install --user fb-idb`.
- iPad: *Einstellungen → Apps → Safari → Erweitert*: **Web-Inspector** and
  **Entfernte Automatisierung** on; paired with the Mac once via USB.
- Storybook on `:4400` binds `0.0.0.0` by default — devices load stories via
  this PC's LAN IP (the script computes it; `localhost` would be the device itself).

Run `apple-remote.sh detect` first — it verifies Mac reachability, simulators,
the paired iPad, and that Storybook is reachable *from* the Mac.

## Command overview

| Command | What it does |
| --- | --- |
| `detect` | Mac/simulators/iPad/Storybook reachability check |
| `sim-open <story-id> [device]` | Boot sim (default "iPhone 16") + open story in Mobile Safari |
| `sim-probe <story-id>` | Open story wrapped in the **live viewport HUD** (see below) |
| `sim-shot <out.png>` | Full-device screenshot (shows keyboard, browser chrome) |
| `sim-tap <x> <y>` | Real touch tap via idb, device points |
| `sim-type <text>` | Type on the open soft keyboard via idb |
| `sim-keyboard on\|off` | Detach/attach hardware keyboard (see keyboard section) |
| `sim-stop` | Shut down booted simulators |
| `ipad-start [sim]` | SSH tunnel + safaridriver + WebDriver session (real iPad, or booted sim with `sim`) |
| `ipad-open <story-id>` | Navigate the session to a story |
| `ipad-js <script>` | Run sync JS, `return` a value |
| `ipad-viewport` | JSON probe: vh/dvh/svh/lvh, safe-area, visualViewport, keyboard estimate |
| `ipad-tap <css>` / `ipad-type <css> <text>` | WebDriver element click / send-keys (see limits!) |
| `ipad-shot <out.png> [css]` | **Element** screenshot (default `html`) |
| `ipad-end` | Delete session, kill tunnel + remote safaridriver |

## The two modes — and why they don't mix

**WebDriver mode** (`ipad-*`): navigation, JS probes, element screenshots, on the
real iPad or a simulator. **Real-input mode** (`sim-tap`/`sim-type` via idb):
actual touch and soft keyboard, simulators only.

⚠️ **A real tap during an active WebDriver session kills it** — iOS pops
„Safari führt einen automatischen Test durch" and the tap is swallowed. Run
`ipad-end` before using `sim-tap`. Consequently you cannot read `ipad-viewport`
while the soft keyboard is open — that's what `sim-probe` exists for.

## Classic mobile traps — how to test each

**Browser bar (100vh ≠ visible height):** `ipad-viewport` on the real iPad.
Measured here: `vh: 1041` vs `dvh/innerHeight: 1005` — a 36px bar that `100vh`
layouts slide under. On the iPhone sim: `741` vs `659`.

**Soft keyboard open (visualViewport shrink, `interactive-widget`):** use the
probe page — `sim-probe <story-id>` loads the story in an iframe under a HUD
that live-renders inner/visual viewport, vh/dvh/svh/lvh, safe-area and keyboard
state; read it off `sim-shot`. Flow:

```bash
apple-remote.sh sim-probe cdk-forms-input-text--default
apple-remote.sh sim-tap 60 105          # focus the input → keyboard slides in
apple-remote.sh sim-shot kbd.png        # HUD shows e.g. „visual 393x391, kbd OPEN ~268px"
apple-remote.sh sim-type 'Hello'        # real typing, then screenshot again
```

**Touch media queries:** real iPad reports `(pointer: coarse)`, `(hover: none)`
natively — `ipad-js 'return matchMedia("(pointer: coarse)").matches'`.

**Safe-area insets:** in the `ipad-viewport` / HUD output (`viewport-fit=cover`
is set on the probe page).

**Focus zoom (< 16px inputs):** Safari zooms the page when a small-font input is
focused. The probe page *disables* this (`maximum-scale=1`) so the HUD stays
readable — to see the zoom itself, open the bare story via `sim-open` and tap.

## Gotchas (all hit in practice)

- **Soft keyboard needs the hardware keyboard detached.** Fresh Simulator.app
  connects the Mac keyboard → tapping an input shows only the „Fertig" accessory
  bar, no keys, **and visualViewport does not shrink**. Fix: `sim-keyboard on`
  (writes the pref, kills sims), then boot again. First keyboard open shows a
  one-time QuickPath intro — dismiss via its „Weiter" button (`sim-tap`, read
  coords from a screenshot).
- **`sim-type` goes through the real keyboard pipeline** — German autocorrect
  and auto-capitalization will mangle literal strings („dvh" → „Doch"). Fine for
  triggering keyboard behavior; don't assert on the exact text.
- **WebDriver send-keys is a no-op on iOS** (real device *and* sim): the call
  succeeds, the field stays empty, no keyboard. Apple limitation — use JS to set
  values in WebDriver mode, or idb for real typing.
- **Full-screen WebDriver screenshot fails on the real iPad** (`unknown error`).
  Element screenshots work — hence `ipad-shot` takes a selector (default `html`).
  There is no CLI screen capture for real devices; for full-screen-with-keyboard
  evidence use the simulator, or photograph the iPad.
- **Real-iPad UA says „Macintosh"** — iPadOS requests desktop sites by default.
  Feature-detect via media queries/`maxTouchPoints`, not the UA string.
- **Booting sims:** `simctl` alone renders the keyboard area blank — have
  Simulator.app open (`open "$(xcode-select -p)/Applications/Simulator.app"`).
  After `sim-keyboard`, Simulator.app may auto-boot its *last* device (e.g. a
  Pro Max) — `sim-open`/`sim-probe` boot "iPhone 16" but an already-booted other
  device wins; `sim-stop` first if in doubt.
- **Tap coordinates are device points** (screenshot px ÷ 3 on iPhone 16 @3x,
  ÷ 2 on @2x iPads). Coordinates drift per device — read them from a fresh
  `sim-shot`, don't reuse blindly.
- **Stale safaridriver:** if `ipad-start` reports „Address already in use", a
  driver from a dead tunnel is still running on the Mac — `ipad-start` now
  pre-kills it, but `ipad-end` is the polite cleanup.

## The probe page

`apps/playground/src/assets/viewport-probe.html`, served by Storybook at
`/assets/viewport-probe.html?story=<story-id>`. Loads the story iframe full-size
and overlays a HUD pinned to the **visual** viewport (plain `position: fixed`
scrolls out of view when the keyboard pans the layout viewport — itself one of
the traps). Works in any browser, no automation needed — also handy opened
manually on the iPad for hands-on keyboard testing.

## Report

Same bar as `verify-in-storybook`: state the engine (real iPad Safari 18.x /
sim iOS 18.x), device, what you interacted with, the measured viewport numbers,
and whether behavior matched expectations. Screenshots stay in the scratchpad.
End sessions with `ipad-end` and shut sims down with `sim-stop` when done.
