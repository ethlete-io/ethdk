---
name: verify-in-mobile-emulator
description: Open a Storybook story on an iOS Simulator (iPhone) or Android emulator to check a component on a real mobile browser engine (touch, viewport, Safari/Chrome quirks). Use when a change is touch- or mobile-viewport-specific and headless Chromium via verify-in-storybook isn't enough. Emulators are optional — this skill first detects whether the tooling exists and, if not, documents how to set it up.
---

# Verify a story on a mobile emulator (iOS Simulator / Android emulator)

`verify-in-storybook` (headless Chromium) is the default and is enough for most
changes. Reach for a **real mobile engine** only when the change is specifically
about touch behavior, mobile viewport/layout, or a Safari/Chrome-mobile quirk
(e.g. touch swipe on table headers, `env(safe-area-inset-*)`, iOS momentum
scroll, `-webkit-` behaviors).

## ⚠️ By default the emulator reports `(pointer: fine)` — touch-gated UI stays in desktop mode

**Root cause:** the Android emulator (and iOS Simulator) are driven by your
**host mouse**, so the browser reports `(pointer: fine)` + `(hover: hover)` and
`(pointer: coarse)` = **false** — even though `navigator.maxTouchPoints` is 5.
Anything gated on `injectHasTouchInput()` (`(pointer: coarse)`, `media-queries.ts`)
or `injectCanHover()` renders in its **desktop** form: in this repo that's the
**RTE docked/floating mobile toolbar** (`rich-text-editor.component.ts`
`dockedToolbar`/`--touch`), the align/table tools, and floating-toolbar
suppression. Verify with the probe at the end of the Android section.

Two ways to get the real touch experience — pick by what you're testing:

### Option A (simplest) — Playwright device emulation, headless, no emulator

Best for pure `(pointer: coarse)`/`(hover)`-gated **rendering**. Correctly sets
both features:

```js
import pw from '<repo>/node_modules/playwright/index.js';
const { chromium, devices } = pw;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'] }); // isMobile+hasTouch → pointer:coarse, hover:none
const page = await ctx.newPage();
await page.goto('http://localhost:4400/iframe.html?id=<story-id>&viewMode=story', { waitUntil: 'domcontentloaded' });
// tap (not click) to fire touch events: await (await page.$('[contenteditable="true"]')).tap();
```

Sanity-check `matchMedia('(pointer: coarse)').matches` (→ `true`) and, for the
RTE, `.et-rich-text-editor--touch`.

### Option B — force coarse pointer *on the real emulator* via CDP

Use when you specifically want the **real Android Chrome engine + soft keyboard +
real touch** *and* the touch-gated rendering. Connect to the on-device Chrome over
the `adb`-forwarded debug port and apply device-metrics/touch overrides.
`Emulation.setEmulatedMedia` alone does **nothing** here — you need
`setDeviceMetricsOverride({mobile:true})` **plus** `setTouchEmulationEnabled`,
applied live (no reload; the RTE's `matchMedia` listener reacts):

```bash
adb forward tcp:9222 localabstract:chrome_devtools_remote   # story already open in emulator Chrome
```
```js
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('iframe.html'));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2.6, mobile: true });
// now (pointer: coarse) === true and .et-rich-text-editor--touch appears; click the editor to show the docked toolbar
```

Then screenshot the device (`adb exec-out screencap -p > …`) — the docked toolbar
renders on the actual emulator screen with the native keyboard.

**Rule of thumb:** pointer/hover *rendering* only → Option A. Real
touch-*gesture* behavior (swipe/momentum/native scroll), the soft keyboard, or a
genuine Safari/Chrome-mobile engine quirk → the emulator (Option B for
touch-gated bits).

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
`simctl`. This machine has Xcode 16.4 + an iOS 18.6 runtime set up (iPhone 16
sims); the detect below confirms it, and the Setup section is the fallback.
Note both conditions: `simctl` present **and** at least one available device
(a fresh Xcode has `simctl` but zero runtimes — see Setup step 3).

```bash
xcode-select -p                       # want a path ending in Xcode.app/Contents/Developer
xcrun simctl help >/dev/null 2>&1 && echo "simctl OK" || echo "no simctl — full Xcode needed"
xcrun simctl list devices available | grep -i iphone | head   # empty → need a runtime (Setup step 3)
```

### Setup (if `simctl` is missing)

**Pick the right Xcode for the Mac's macOS first.** The App Store only offers the
*latest* Xcode, which often demands a newer macOS than is installed (e.g. Xcode
26.1+ / 27 need macOS 26.2+). Check `sw_vers -productVersion`, then download a
compatible build from [developer.apple.com/download/all](https://developer.apple.com/download/all/)
(a free Apple ID works) — cross-reference [xcodereleases.com](https://xcodereleases.com/)
for each build's minimum macOS. On **macOS 15.x Sequoia** the newest that runs is
**Xcode 26.0.1** (or **16.4**, last of the 16 line).

1. Download the `.xip`, expand it (`cd ~/Downloads && xip --expand Xcode_16.4.xip`
   — takes minutes), and move `Xcode.app` into `/Applications`. (App Store install
   is fine only when its version supports your macOS.)
2. Point the toolchain at it and accept the licence (the `sudo` steps prompt for
   the user's password — they must run those):
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   xcodebuild -runFirstLaunch
   ```
3. **Download an iOS runtime — this is the step that's easy to miss.**
   `xcrun simctl help` will say OK and `xcode-select -p` will point at Xcode, yet
   `simctl list devices available` shows **nothing** until a runtime is installed
   (a fresh Xcode ships none). Pull one (~7 GB):
   ```bash
   xcodebuild -downloadPlatform iOS
   ```
   Then `xcrun simctl list runtimes` shows e.g. `iOS 18.6`, and
   `xcrun simctl list devices available` lists iPhone 16 models.

### Launch a story

`localhost` inside the iOS Simulator **is** the Mac's `localhost` (shared network
stack), so the same `:4400` URL works unchanged — no host rewrite needed.

```bash
open "$(xcode-select -p)/Applications/Simulator.app"   # NOT `open -a Simulator` — that name isn't registered
xcrun simctl boot "iPhone 16" 2>/dev/null || true      # or pick from `simctl list devices available`
xcrun simctl bootstatus booted                          # blocks until CoreSimulator reports booted
xcrun simctl openurl booted \
  "http://localhost:4400/iframe.html?id=<story-id>&viewMode=story"
```

**First-boot gotcha:** the *very first* boot of a freshly-downloaded runtime runs
a data-restore phase, so the device sits on the Apple logo for a minute or two.
`bootstatus` (and `simctl` calling it "Booted") returns before SpringBoard is
actually up, so an immediate `openurl` fails with `NSPOSIXErrorDomain code=60`
(timed out). Wait for SpringBoard, then fire `openurl`:

```bash
until xcrun simctl spawn booted launchctl print system 2>/dev/null \
  | grep -q com.apple.SpringBoard; do sleep 5; done
```

Subsequent boots are fast and don't need this. This opens the story in Mobile
Safari on the simulated iPhone. Interact by hand, or screenshot headlessly:

```bash
xcrun simctl io booted screenshot /path/in/scratchpad/ios-story.png
```

---

## Android emulator

### Detect

Needs the Android SDK (`adb` + `emulator`, plus at least one AVD). This is set up
on this machine via `brew` (SDK at `/usr/local/share/android-commandlinetools`,
env in `~/.zshrc`, a `pixel` AVD) — the detect below confirms it; the Setup
section is the fallback if it ever isn't.

```bash
export ANDROID_HOME=${ANDROID_HOME:-/usr/local/share/android-commandlinetools}
"$ANDROID_HOME/platform-tools/adb" version 2>/dev/null | head -1
"$ANDROID_HOME/emulator/emulator" -list-avds 2>/dev/null   # want at least one AVD (e.g. `pixel`)
```

### Setup (if missing)

Easiest is **Android Studio** (bundles the SDK, an emulator, and the AVD
Manager GUI): install it, then in *More Actions → Virtual Device Manager* create
a Pixel-class AVD. CLI-only path (this is what's set up on this machine — SDK
lives at `/usr/local/share/android-commandlinetools`):

```bash
# 1. Command-line tools + a JDK (sdkmanager needs Java; brew's temurin pkg
#    needs YOUR sudo password, so the user must run that one).
brew install --cask android-commandlinetools
brew install --cask temurin        # run by the user — the .pkg installer prompts for sudo

# 2. Point env at the brew SDK (also append to ~/.zshrc for new shells).
export ANDROID_HOME=/usr/local/share/android-commandlinetools
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# 3. Install packages. ABI MUST match the Mac's arch: x86_64 on Intel,
#    arm64-v8a on Apple Silicon — check with `uname -m` first. (This is an
#    Intel machine → x86_64.) `yes |` auto-accepts the SDK licenses.
yes | sdkmanager "platform-tools" "emulator" "system-images;android-34;google_apis;x86_64"

# 4. Create the AVD (echo no = don't add a custom hardware profile).
echo no | avdmanager create avd -n pixel -k "system-images;android-34;google_apis;x86_64" -d pixel
```

### Launch a story

**Networking gotcha:** inside the Android emulator, `localhost` is the *emulator
itself*, not your Mac. The host loopback is reachable at the special alias
**`10.0.2.2`**. So rewrite the host in the URL — `10.0.2.2:4400` — even though
Storybook is bound to localhost on the Mac (the alias maps through regardless).

Boot the AVD, then wait for `sys.boot_completed` (a bare `wait-for-device`
returns too early — the UI isn't up yet; cold boot is ~90s):

```bash
emulator -avd pixel -no-snapshot -netdelay none -netspeed full -no-boot-anim &  # run in background
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 5; done
adb shell am start -a android.intent.action.VIEW \
  -d "http://10.0.2.2:4400/iframe.html?id=<story-id>&viewMode=story"
```

**Chrome first-run gotcha:** on a fresh AVD, Chrome swallows the first VIEW
intent behind its onboarding — a "Welcome to Chrome" screen, then a
"notifications" dialog — so the story won't load until you clear them. Screenshot,
tap through, then re-fire the intent. On the default Pixel (1080×1920) the tap
targets are:

- "Use without an account" → `adb shell input tap 540 1631`
- notifications "No thanks" → `adb shell input tap 590 1470`

These only appear once per AVD; subsequent runs open the URL directly. Verify by
screenshotting after each step (coordinates drift with device size — re-read the
screenshot, don't trust the numbers blindly):

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
