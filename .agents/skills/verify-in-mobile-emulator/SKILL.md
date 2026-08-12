---
name: verify-in-mobile-emulator
description: Open a Storybook story on an iOS Simulator (iPhone) or Android emulator to check a component on a real mobile browser engine (touch, viewport, Safari/Chrome quirks). Use when a change is touch- or mobile-viewport-specific and headless Chromium via verify-in-storybook isn't enough. Emulators are optional - this skill first detects whether the tooling exists and, if not, documents how to set it up.
---

# Verify a story on a mobile emulator (iOS Simulator / Android emulator)

`verify-in-storybook` (headless Chromium) is the default and is enough for most
changes. Reach for a **real mobile engine** only when the change is specifically
about touch behavior, mobile viewport/layout, or a Safari/Chrome-mobile quirk
(e.g. touch swipe on table headers, `env(safe-area-inset-*)`, iOS momentum
scroll, `-webkit-` behaviors).

## ⚠️ By default the emulator reports `(pointer: fine)` - touch-gated UI stays in desktop mode

**Root cause:** the Android emulator (and iOS Simulator) are driven by your
**host mouse**, so the browser reports `(pointer: fine)` + `(hover: hover)` and
`(pointer: coarse)` = **false** - even though `navigator.maxTouchPoints` is 5.
Anything gated on `injectHasTouchInput()` (`(pointer: coarse)`, `media-queries.ts`)
or `injectCanHover()` renders in its **desktop** form: in this repo that's the
**RTE docked/floating mobile toolbar** (`rich-text-editor.component.ts`
`dockedToolbar`/`--touch`), the align/table tools, and floating-toolbar
suppression. Verify with the probe at the end of the Android section.

Two ways to get the real touch experience - pick by what you're testing:

### Option A (simplest) - Playwright device emulation, headless, no emulator

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

### Option B - force coarse pointer *on the real emulator* via CDP

Use when you specifically want the **real Android Chrome engine + soft keyboard +
real touch** *and* the touch-gated rendering. Connect to the on-device Chrome over
the `adb`-forwarded debug port and apply device-metrics/touch overrides.
`Emulation.setEmulatedMedia` alone does **nothing** here - you need
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

Then screenshot the device (`adb exec-out screencap -p > …`) - the docked toolbar
renders on the actual emulator screen with the native keyboard.

**Rule of thumb:** pointer/hover *rendering* only → Option A. Real
touch-*gesture* behavior (swipe/momentum/native scroll), the soft keyboard, or a
genuine Safari/Chrome-mobile engine quirk → the emulator (Option B for
touch-gated bits).

Emulators are **optional dev tooling** and may not be installed. Always run the
detection step first, and **use the variant matching the host OS** (`uname` -
`Darwin` vs `Linux`): the iOS Simulator exists **only on macOS**; the Android
emulator works on both, but install paths and required launch flags differ per
OS (see the Android section). If the tooling is missing, either follow the setup
section (with the user's go-ahead - these are large, slow installs) or fall back
to `verify-in-storybook`.

## 0. Storybook must be running on :4400

Same as `verify-in-storybook` step 1 - check before starting a second instance:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4400/
```

`200` → proceed. Otherwise start it in the background and poll until `200`:

```bash
npm run storybook   # nx run storybook:storybook --no-open, serves on :4400
```

For a **physical device** on your LAN (not needed for emulators) bind all
interfaces instead: `nx run storybook:storybook --no-open -c network` (host
`0.0.0.0`), then use the host machine's LAN IP in the URL.

Get the story id exactly as in `verify-in-storybook` step 2 (from
`http://localhost:4400/index.json`). The URL you'll open on the device is the
**iframe** URL:

```
http://localhost:4400/iframe.html?id=<story-id>&viewMode=story
```

---

## iOS Simulator (iPhone) - macOS only

On a Linux host, skip this section entirely (there is no iOS Simulator for
Linux); use the Android emulator, Playwright WebKit for a rough engine-only
approximation - or drive the team Mac's simulators and the real iPad over LAN
via the **`verify-on-apple-devices`** skill.

### Detect

Full **Xcode** is required - the Command Line Tools alone do **not** ship
`simctl`. This machine has Xcode 16.4 + an iOS 18.6 runtime set up (iPhone 16
sims); the detect below confirms it, and the Setup section is the fallback.
Note both conditions: `simctl` present **and** at least one available device
(a fresh Xcode has `simctl` but zero runtimes - see Setup step 3).

```bash
xcode-select -p                       # want a path ending in Xcode.app/Contents/Developer
xcrun simctl help >/dev/null 2>&1 && echo "simctl OK" || echo "no simctl - full Xcode needed"
xcrun simctl list devices available | grep -i iphone | head   # empty → need a runtime (Setup step 3)
```

### Setup (if `simctl` is missing)

**Pick the right Xcode for the Mac's macOS first.** The App Store only offers the
*latest* Xcode, which often demands a newer macOS than is installed (e.g. Xcode
26.1+ / 27 need macOS 26.2+). Check `sw_vers -productVersion`, then download a
compatible build from [developer.apple.com/download/all](https://developer.apple.com/download/all/)
(a free Apple ID works) - cross-reference [xcodereleases.com](https://xcodereleases.com/)
for each build's minimum macOS. On **macOS 15.x Sequoia** the newest that runs is
**Xcode 26.0.1** (or **16.4**, last of the 16 line).

1. Download the `.xip`, expand it (`cd ~/Downloads && xip --expand Xcode_16.4.xip`
   - takes minutes), and move `Xcode.app` into `/Applications`. (App Store install
   is fine only when its version supports your macOS.)
2. Point the toolchain at it and accept the licence (the `sudo` steps prompt for
   the user's password - they must run those):
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   xcodebuild -runFirstLaunch
   ```
3. **Download an iOS runtime - this is the step that's easy to miss.**
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
stack), so the same `:4400` URL works unchanged - no host rewrite needed.

```bash
open "$(xcode-select -p)/Applications/Simulator.app"   # NOT `open -a Simulator` - that name isn't registered
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

### Driving a real touch *gesture* - safaridriver, not idb

`idb ui swipe` starts moving immediately, so it cannot express **press, hold, then
drag** - the gesture anything long-press-armed needs (the scheduler's
drag-to-create arms after 400ms held still, and any movement before that cancels
it). `safaridriver` can: its W3C Actions endpoint accepts `pointerType: "touch"`
against a simulator and dispatches real WebKit touch events, with `pause` steps
between `pointerDown` and the moves.

```bash
/usr/bin/safaridriver --port 4444 &
curl -s -X POST http://localhost:4444/session -H 'Content-Type: application/json' \
  -d '{"capabilities":{"alwaysMatch":{"browserName":"safari","platformName":"ios","safari:useSimulator":true}}}'
```

Then `POST /session/<id>/actions` with one `pointer` input source:
`pointerMove` → `pointerDown` → `pause` (800) → several `pointerMove`s → `pointerUp`.
Read the result with `POST /session/<id>/execute/sync` (touch-event counters
installed beforehand, `defaultPrevented`, `scrollTop`, `getSelection()`) and
`xcrun simctl io <udid> screenshot` for the visual.

Three things that will otherwise cost a session:

- **`pointerUp` only lands if it is in the same `actions` call as the
  `pointerDown`.** A follow-up call containing just the `pointerUp` silently does
  nothing - the finger stays down. To sample the DOM *mid-gesture*, end the first
  call after the moves, probe, then `DELETE /session/<id>/actions`: the implicit
  release is what finally fires `touchend`.
- **A fling swipe wedges the driver.** Momentum scrolling leaves the next request
  hanging until it times out; the gesture itself still happened, so screenshot the
  device to read the outcome rather than retrying.
- **`session not created: already paired with another WebDriver session`** after
  that wedge: `xcrun simctl terminate <udid> com.apple.mobilesafari`, then create
  the session again.

`idb` is still the tool for taps and typing outside a WebDriver session, and the
two modes do not mix (see `verify-on-apple-devices`). It may be installed without
an `idb` on `PATH` - `pip3 install --user fb-idb` under Xcode's interpreter is
reachable as
`/Applications/Xcode.app/Contents/Developer/usr/bin/python3 -m idb.cli.main`.

---

## Android emulator

### Detect

Needs the Android SDK (`adb` + `emulator`, plus at least one AVD). Known setups
by machine - both use a `pixel` AVD and have env vars in `~/.zshrc`:

- **macOS**: installed via `brew`, SDK at `/usr/local/share/android-commandlinetools`
- **Linux (Fedora)**: SDK at `~/Android/Sdk` (the standard Linux location)

The detect below tries both; the Setup section is the fallback if neither hits.

```bash
for d in "$ANDROID_HOME" "$HOME/Android/Sdk" /usr/local/share/android-commandlinetools; do
  [ -n "$d" ] && [ -x "$d/emulator/emulator" ] && export ANDROID_HOME=$d && break
done
"$ANDROID_HOME/platform-tools/adb" version 2>/dev/null | head -1
"$ANDROID_HOME/emulator/emulator" -list-avds 2>/dev/null   # want at least one AVD (e.g. `pixel`)
```

### Setup (if missing)

Easiest is **Android Studio** (bundles the SDK, an emulator, and the AVD
Manager GUI): install it, then in *More Actions → Virtual Device Manager* create
a Pixel-class AVD. CLI-only paths per OS below. In both cases the ABI **must
match the host arch** (`uname -m`): `x86_64` vs `arm64-v8a`.

**macOS (brew):**

```bash
# 1. Command-line tools + a JDK (sdkmanager needs Java; brew's temurin pkg
#    needs YOUR sudo password, so the user must run that one).
brew install --cask android-commandlinetools
brew install --cask temurin        # run by the user - the .pkg installer prompts for sudo
export ANDROID_HOME=/usr/local/share/android-commandlinetools
```

**Linux:** grab the "command line tools only" zip from
developer.android.com/studio (a `commandlinetools-linux-*.zip` from
`dl.google.com/android/repository/`), and check KVM - without it the emulator
is unusably slow:

```bash
# 1. Tools + prerequisites (any JDK 17+ works; Fedora ships one).
java -version                          # missing → sudo dnf install java-latest-openjdk
[ -r /dev/kvm ] && [ -w /dev/kvm ] && echo "KVM OK" || echo "no /dev/kvm access - add user to kvm group"
mkdir -p ~/Android/Sdk/cmdline-tools
unzip -q commandlinetools-linux-*.zip && mv cmdline-tools ~/Android/Sdk/cmdline-tools/latest
export ANDROID_HOME=$HOME/Android/Sdk
```

**Both OSes, then:**

```bash
# 2. Env (also append to ~/.zshrc for new shells).
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# 3. Install packages (`yes |` auto-accepts the SDK licenses; ABI per uname -m).
yes | sdkmanager "platform-tools" "emulator" "system-images;android-35;google_apis;x86_64"

# 4. Create the AVD (echo no = don't add a custom hardware profile).
echo no | avdmanager create avd -n pixel -k "system-images;android-35;google_apis;x86_64" -d pixel

# 5. Sanity-check hardware acceleration (HVF on macOS, KVM on Linux).
emulator -accel-check   # want "... is installed and usable."
```

### Launch a story

**Networking gotcha:** inside the Android emulator, `localhost` is the *emulator
itself*, not the host. The host loopback is reachable at the special alias
**`10.0.2.2`**. So rewrite the host in the URL - `10.0.2.2:4400` - even though
Storybook is bound to localhost on the host (the alias maps through regardless).

**Linux launch flags - both are required on the Fedora machine** (add them to
the `emulator` command below; harmless elsewhere, macOS doesn't need them):

- **`-gpu host`** - the emulator's bundled SwiftShader software renderer
  segfaults on this glibc/Mesa combo. Symptom: the emulator process exits with
  code 0 and **no error in its own log** right after "Emulator is performing a
  full startup", `adb devices` never lists it, and `coredumpctl` shows a
  SIGSEGV in `gles_swiftshader/libGLESv2.so`. `-gpu host` renders on the real
  GPU instead (needs working GL drivers; headless `-no-window` works too).
- **`-feature -ModemSimulator`** - without it QEMU dies immediately with
  `Unable to connect character device modem: address resolution failed for ::1:<port>`.

Boot the AVD, then wait for `sys.boot_completed` (a bare `wait-for-device`
returns too early - the UI isn't up yet; cold boot is ~90s):

```bash
emulator -avd pixel -no-snapshot -netdelay none -netspeed full -no-boot-anim &  # run in background
# Linux: emulator -avd pixel -no-snapshot -no-boot-anim -gpu host -feature -ModemSimulator &
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 5; done
adb shell am start -a android.intent.action.VIEW \
  -d "http://10.0.2.2:4400/iframe.html?id=<story-id>&viewMode=story"
```

**Chrome first-run gotcha:** on a fresh AVD, Chrome swallows the first VIEW
intent behind its onboarding - a "Welcome to Chrome" screen, then a
"notifications" dialog - so the story won't load until you clear them. Screenshot,
tap through, then re-fire the intent. On the default Pixel (1080×1920) the tap
targets are:

- "Use without an account" → `adb shell input tap 540 1631`
- notifications "No thanks" → `adb shell input tap 590 1470`

These only appear once per AVD; subsequent runs open the URL directly. Verify by
screenshotting after each step (coordinates drift with device size - re-read the
screenshot, don't trust the numbers blindly):

```bash
adb exec-out screencap -p > /path/in/scratchpad/android-story.png
```

---

## Keep the emulator running between tests

Cold boot is the expensive part (~90s); everything after (`am start`, CDP,
screenshots, taps) is seconds. While iterating on a change, **leave the emulator
(and any `adb forward`) up between rounds** - re-firing the VIEW intent on a
running emulator is instant, and Chrome keeps its state (first-run dialogs
already dismissed). Only `adb emu kill` when the whole verification session is
done - or leave it to the user, who may want to poke at the result themselves.

## Report

State which engine you drove (iOS Safari / Android Chrome), the device/viewport,
what you interacted with, and whether it matched expectations - same bar as
`verify-in-storybook`. Keep screenshots in the scratchpad, not the repo. If the
tooling wasn't installed and the user didn't want to install it, say so and note
that you fell back to headless Chromium (or didn't verify on mobile).
