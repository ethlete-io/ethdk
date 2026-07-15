---
name: verify-in-mobile-emulator
description: Open a Storybook story on an iOS Simulator (iPhone) or Android emulator to check a component on a real mobile browser engine (touch, viewport, Safari/Chrome quirks). Use when a change is touch- or mobile-viewport-specific and headless Chromium via verify-in-storybook isn't enough. Emulators are optional — this skill first detects whether the tooling exists and, if not, documents how to set it up.
---

# Verify a story on a mobile emulator (iOS Simulator / Android emulator)

`verify-in-storybook` (headless Chromium) is the default and is enough for most
changes. Reach for a **real mobile engine** only when the change is specifically
about touch behavior, mobile viewport/layout, or a Safari/Chrome-mobile quirk
(e.g. the RTE docked/floating mobile toolbar, touch swipe on table headers,
`env(safe-area-inset-*)`, iOS momentum scroll, `-webkit-` behaviors).

Emulators are **optional dev tooling** and are not installed by default on this
machine. Always run the detection step first. If the tooling is missing, either
follow the setup section (with the user's go-ahead — these are large, slow
installs) or fall back to `verify-in-storybook`.

## 0. Storybook must be running on :4400

Same as `verify-in-storybook` step 1 — check before starting a second instance:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4400/
```

`200` → proceed. Otherwise start it in the background and poll until `200`:

```bash
npm run storybook   # nx run playground:storybook --no-open, serves on :4400
```

For a **physical device** on your LAN (not needed for emulators) bind all
interfaces instead: `nx run playground:storybook --no-open -c network` (host
`0.0.0.0`), then use your Mac's LAN IP in the URL.

Get the story id exactly as in `verify-in-storybook` step 2 (from
`http://localhost:4400/index.json`). The URL you'll open on the device is the
**iframe** URL:

```
http://localhost:4400/iframe.html?id=<story-id>&viewMode=story
```

---

## iOS Simulator (iPhone)

### Detect

Full **Xcode** is required — the Command Line Tools alone do **not** ship
`simctl`. This machine currently has only CLT, so this path needs setup first.

```bash
xcode-select -p                       # want a path ending in Xcode.app/Contents/Developer
xcrun simctl help >/dev/null 2>&1 && echo "simctl OK" || echo "no simctl — full Xcode needed"
```

### Setup (if `simctl` is missing)

1. Install Xcode from the App Store (large, ~15 GB, slow).
2. Point the toolchain at it and accept the licence:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   xcodebuild -runFirstLaunch          # installs the simulator runtimes
   ```
3. Confirm a device is available: `xcrun simctl list devices available`.

### Launch a story

`localhost` inside the iOS Simulator **is** the Mac's `localhost` (shared network
stack), so the same `:4400` URL works unchanged — no host rewrite needed.

```bash
open -a Simulator                                   # boots the last-used device
xcrun simctl boot "iPhone 15" 2>/dev/null || true   # or pick from `simctl list devices`
xcrun simctl openurl booted \
  "http://localhost:4400/iframe.html?id=<story-id>&viewMode=story"
```

This opens the story in Mobile Safari on the simulated iPhone. Interact by hand,
or screenshot headlessly:

```bash
xcrun simctl io booted screenshot /path/in/scratchpad/ios-story.png
```

---

## Android emulator

### Detect

Needs the Android SDK (`adb` + `emulator`, plus at least one AVD). None is
installed here, so this path needs setup first.

```bash
which adb emulator; echo "ANDROID_HOME=${ANDROID_HOME:-unset}"
"${ANDROID_HOME:-$HOME/Library/Android/sdk}/emulator/emulator" -list-avds 2>/dev/null
```

### Setup (if missing)

Easiest is **Android Studio** (bundles the SDK, an emulator, and the AVD
Manager GUI): install it, then in *More Actions → Virtual Device Manager* create
a Pixel-class AVD. CLI-only alternative:

```bash
brew install --cask android-commandlinetools
sdkmanager "platform-tools" "emulator" "system-images;android-34;google_apis;arm64-v8a"
avdmanager create avd -n pixel -k "system-images;android-34;google_apis;arm64-v8a" -d pixel
# then export ANDROID_HOME=$HOME/Library/Android/sdk and add platform-tools + emulator to PATH
```

### Launch a story

**Networking gotcha:** inside the Android emulator, `localhost` is the *emulator
itself*, not your Mac. The host loopback is reachable at the special alias
**`10.0.2.2`**. So rewrite the host in the URL — `10.0.2.2:4400` — even though
Storybook is bound to localhost on the Mac (the alias maps through regardless).

```bash
emulator -avd pixel -no-snapshot -netdelay none -netspeed full &   # boot the AVD
adb wait-for-device
adb shell am start -a android.intent.action.VIEW \
  -d "http://10.0.2.2:4400/iframe.html?id=<story-id>&viewMode=story"
```

That opens the story in Chrome on the emulator. Screenshot headlessly:

```bash
adb exec-out screencap -p > /path/in/scratchpad/android-story.png
```

---

## Report

State which engine you drove (iOS Safari / Android Chrome), the device/viewport,
what you interacted with, and whether it matched expectations — same bar as
`verify-in-storybook`. Keep screenshots in the scratchpad, not the repo. If the
tooling wasn't installed and the user didn't want to install it, say so and note
that you fell back to headless Chromium (or didn't verify on mobile).
