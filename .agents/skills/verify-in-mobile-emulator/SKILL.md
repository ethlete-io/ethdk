---
name: verify-in-mobile-emulator
description: Open a Storybook story on an Android emulator to check a component on a real mobile browser engine (touch, viewport, Chrome quirks; iOS goes through verify-on-apple-devices). Use when a change is touch- or mobile-viewport-specific and headless Chromium via verify-in-storybook isn't enough. Emulators are optional - this skill first detects whether the tooling exists and, if not, documents how to set it up.
---

# Verify a story on the Android emulator

`verify-in-storybook` (headless Chromium) is the default and is enough for most
changes. Reach for a **real mobile engine** only when the change is specifically
about touch behavior, mobile viewport/layout, or a Safari/Chrome-mobile quirk
(e.g. touch swipe on table headers, `env(safe-area-inset-*)`, iOS momentum
scroll, `-webkit-` behaviors).

## ⚠️ By default the emulator reports `(pointer: fine)` - touch-gated UI stays in desktop mode

**Root cause:** the Android emulator is driven by your
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

**Soft keyboard tests: skip `setDeviceMetricsOverride`.** It freezes the viewport: the keyboard opens,
but `visualViewport.height` never shrinks, so anything that follows the keyboard inset looks broken. Send
only `setTouchEmulationEnabled`, then reload the page - `(pointer: coarse)` matches and the viewport
resizes normally. If Gboard shows only a floating pill, the emulator is in stylus input mode: turn off
Settings → Gboard → Write in text fields. The setting stays off on that AVD.

Then screenshot the device (`adb exec-out screencap -p > …`) - the docked toolbar
renders on the actual emulator screen with the native keyboard.

**Rule of thumb:** pointer/hover *rendering* only → Option A. Real
touch-*gesture* behavior (swipe/momentum/native scroll), the soft keyboard, or a
genuine Safari/Chrome-mobile engine quirk → the emulator (Option B for
touch-gated bits).

Emulators are **optional dev tooling** and may not be installed. Always run the
detection step first, and **use the variant matching the host OS** (`uname` -
`Darwin` vs `Linux`): the Android emulator works on both, but install paths and
required launch flags differ per OS (see the Android section). If the tooling is missing, either follow the setup
section (with the user's go-ahead - these are large, slow installs) or fall back
to `verify-in-storybook`.

## 0. Storybook must be running on :4400

Same as `verify-in-storybook` step 1 - check before starting a second instance:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4400/
```

`200` → proceed. Otherwise start it in the background and poll until `200`:

```bash
npm run storybook   # nx run storybook:storybook:network, serves on :4400 (host 0.0.0.0)
```

Get the story id exactly as in `verify-in-storybook` step 2 (from
`http://localhost:4400/index.json`). The URL you'll open on the device is the
**iframe** URL:

```
http://localhost:4400/iframe.html?id=<story-id>&viewMode=story
```

---

## iOS (iPhone / iPad)

This host is Linux: there is no iOS Simulator here. Real iOS Safari runs on the
team Mac (reached over ssh) and the iPad; use the **`verify-on-apple-devices`**
skill, which also holds the safaridriver long-press recipe.

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

State which engine you drove, the device/viewport,
what you interacted with, and whether it matched expectations - same bar as
`verify-in-storybook`. Keep screenshots in the scratchpad, not the repo. If the
tooling wasn't installed and the user didn't want to install it, say so and note
that you fell back to headless Chromium (or didn't verify on mobile).
