#!/usr/bin/env bash
# Drive the team Mac's iOS Simulator and the real iPad from a Linux PC over LAN.
# See SKILL.md in this directory for setup, gotchas, and usage examples.
set -euo pipefail

MAC_HOST=${ETHLETE_MAC_HOST:-ethlete-mac}
DRIVER_PORT=${ETHLETE_SAFARIDRIVER_PORT:-4444}
STATE_DIR=${TMPDIR:-/tmp}/ethlete-apple-remote
SID_FILE=$STATE_DIR/ipad-session-id
mkdir -p "$STATE_DIR"

mac() { ssh -T -o BatchMode=yes -o ConnectTimeout=8 "$MAC_HOST" "$@"; }

# The LAN IP of THIS machine as seen from the Mac — Storybook URLs must use it,
# never localhost (that would be the simulator/iPad itself).
pc_ip() {
  local mac_ip
  mac_ip=$(ssh -G "$MAC_HOST" | awk '/^hostname /{print $2}')
  ip route get "$mac_ip" | grep -oP 'src \K\S+'
}

story_url() { # <story-id-or-url>
  case $1 in
    http*) echo "$1" ;;
    *) echo "http://$(pc_ip):4400/iframe.html?id=$1&viewMode=story" ;;
  esac
}

wd() { # <method> <path> [json-body]  → WebDriver call against the tunnel
  curl -s -X "$1" "http://localhost:$DRIVER_PORT$2" \
    ${3:+-H "Content-Type: application/json" -d "$3"}
}

sid() { cat "$SID_FILE"; }

sim_boot() { # <device-name> — launch Simulator.app (UI!), boot, and wait for SpringBoard.
  # simctl alone boots headless (black framebuffer, blank keyboard area, no window on
  # the Mac) and openurl right after bootstatus times out — SpringBoard isn't up yet.
  # Fast path: device already booted + Simulator.app running → return in ~2s.
  if mac 'xcrun simctl list devices booted | grep -q "(Booted)" && pgrep -xq Simulator'; then return 0; fi
  echo "booting $1 (cold boot can take ~60s; anything past that is an error, not patience)…" >&2
  mac "open -g \"\$(xcode-select -p)/Applications/Simulator.app\"; xcrun simctl boot \"$1\" 2>/dev/null || true; xcrun simctl bootstatus booted" >/dev/null
  # bounded SpringBoard wait — 20×3s max, then fail loudly instead of hanging forever
  mac 'for i in $(seq 1 20); do
         xcrun simctl spawn booted launchctl print system 2>/dev/null | grep -q com.apple.SpringBoard && exit 0
         sleep 3
       done
       echo "SpringBoard did not come up within 60s" >&2; exit 1'
}

sim_udid() { # <device-name> → UDID of that available device
  mac 'xcrun simctl list devices available' | grep -F "$1 (" | grep -oE '[0-9A-F-]{36}' | head -1
}

find_el() { # <css-selector> → element id
  local body
  body=$(python3 -c 'import json,sys; print(json.dumps({"using": "css selector", "value": sys.argv[1]}))' "$1")
  wd POST "/session/$(sid)/element" "$body" \
    | python3 -c "import json,sys; v=json.load(sys.stdin)['value']; assert isinstance(v,dict) and 'error' not in v, v; print(list(v.values())[0])"
}

# Probes the classic mobile-viewport traps: vh/dvh/svh/lvh, safe-area insets,
# visualViewport (shrinks when the soft keyboard is open / browser bar shown).
VIEWPORT_PROBE='return (() => {
  const p = document.createElement("div");
  p.style.cssText = "position:fixed;top:0;width:0;";
  document.body.appendChild(p);
  const h = (v) => { p.style.height = v; return p.getBoundingClientRect().height; };
  const sizes = { vh: h("100vh"), dvh: h("100dvh"), svh: h("100svh"), lvh: h("100lvh") };
  p.style.cssText = "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  const cs = getComputedStyle(p);
  const safeArea = { top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft };
  p.remove();
  const vv = window.visualViewport;
  return { innerWidth, innerHeight, ...sizes, safeArea,
    visualViewport: vv ? { width: vv.width, height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale } : null,
    keyboardLikelyOpen: vv ? innerHeight - vv.height > 100 : null,
    activeElement: document.activeElement?.tagName };
})()'

case ${1:-help} in
  detect)
    mac 'echo "mac: $(hostname) ($(sw_vers -productVersion))"'
    mac 'xcrun simctl list devices available | grep -ci iphone | sed "s/^/iphone sims: /"'
    mac 'xcrun devicectl list devices 2>/dev/null | tail -n +3 | sed "s/^/device: /"' || true
    echo "storybook from mac: $(mac "curl -s -o /dev/null -w '%{http_code}' http://$(pc_ip):4400/" || echo unreachable)"
    ;;

  sim-open) # <story-id-or-url> [device-name] — boots sim (with UI) if needed, opens URL
    sim_boot "${3:-iPhone 16}"
    mac "xcrun simctl openurl booted '$(story_url "$2")'"
    echo "opened on simulator: $(story_url "$2")"
    ;;

  sim-probe) # <story-id> [device-name] — open story wrapped in the live viewport HUD (assets/viewport-probe.html);
             # use with sim-tap/sim-type, read metrics off sim-shot (works without a WebDriver session)
    URL="http://$(pc_ip):4400/assets/viewport-probe.html?story=$2"
    sim_boot "${3:-iPhone 16}"
    mac "xcrun simctl openurl booted '$URL'"
    echo "opened probe: $URL"
    ;;

  sim-shot) # <out.png>
    mac 'xcrun simctl io booted screenshot -' > "$2" 2>/dev/null
    file "$2"
    ;;

  sim-tap) # <x> <y> — real touch tap (device points); focusing an input opens the soft keyboard
    UDID=$(mac 'xcrun simctl list devices booted' | grep -oE '[0-9A-F-]{36}' | head -1)
    mac "export PATH=/usr/local/bin:\$PATH; ~/Library/Python/*/bin/idb ui tap $2 $3 --udid $UDID 2>/dev/null"
    ;;

  sim-swipe) # <x1> <y1> <x2> <y2> [duration-s] — real touch swipe (device points), e.g. to scroll
    UDID=$(mac 'xcrun simctl list devices booted' | grep -oE '[0-9A-F-]{36}' | head -1)
    mac "export PATH=/usr/local/bin:\$PATH; ~/Library/Python/*/bin/idb ui swipe --duration ${6:-0.3} $2 $3 $4 $5 --udid $UDID 2>/dev/null"
    ;;

  sim-type) # <text> — types on the open soft keyboard (tap a field first via sim-tap)
    UDID=$(mac 'xcrun simctl list devices booted' | grep -oE '[0-9A-F-]{36}' | head -1)
    TEXT=$(printf %q "$2")
    mac "export PATH=/usr/local/bin:\$PATH; ~/Library/Python/*/bin/idb ui text $TEXT --udid $UDID 2>/dev/null"
    ;;

  sim-keyboard) # on|off [device-name] — detach the hardware keyboard so the soft keyboard shows (restarts sims)
    # Modern Simulator reads the per-device DevicePreferences key, NOT the legacy global
    # ConnectHardwareKeyboard — writing only the global one silently does nothing.
    [ "$2" = on ] && V=false && D=0 || { V=true; D=1; }
    DEVICE=${3:-iPhone 16}
    UDID=$(sim_udid "$DEVICE")
    [ -n "$UDID" ] || { echo "no available device named '$DEVICE'" >&2; exit 1; }
    mac "defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool $V; defaults write com.apple.iphonesimulator DevicePreferences -dict-add '$UDID' '{ConnectHardwareKeyboard = $D;}'; xcrun simctl shutdown booted 2>/dev/null; killall Simulator 2>/dev/null || true"
    echo "soft keyboard $2 for $DEVICE ($UDID); re-run sim-open / sim-probe"
    ;;

  sim-stop)
    mac 'xcrun simctl shutdown booted 2>/dev/null || true'
    ;;

  ipad-start) # [sim] — tunnel + safaridriver + session (against the real iPad, or the booted simulator with `sim`)
    if ! curl -sf "http://localhost:$DRIVER_PORT/status" >/dev/null 2>&1; then
      mac 'pkill -x safaridriver 2>/dev/null || true'   # stale driver from a dead tunnel
      ssh -f -T -o BatchMode=yes -o ExitOnForwardFailure=yes \
        -L "$DRIVER_PORT:localhost:$DRIVER_PORT" "$MAC_HOST" \
        "/usr/bin/safaridriver --port $DRIVER_PORT"
      for _ in $(seq 1 10); do
        curl -sf "http://localhost:$DRIVER_PORT/status" >/dev/null 2>&1 && break
        sleep 1
      done
    fi
    CAPS='{"browserName":"safari","platformName":"ios"}'
    [ "${2:-}" = sim ] && CAPS='{"browserName":"safari","platformName":"ios","safari:useSimulator":true}'
    RESP=$(wd POST /session "{\"capabilities\":{\"alwaysMatch\":$CAPS}}")
    SID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['value'].get('sessionId',''))" 2>/dev/null || true)
    if [ -z "$SID" ] && echo "$RESP" | grep -q "already paired"; then
      # stale pairing from a dead session: drop it and restart the driver, then retry once
      [ -f "$SID_FILE" ] && wd DELETE "/session/$(sid)" >/dev/null 2>&1 && rm -f "$SID_FILE"
      pkill -f "ssh.*-L $DRIVER_PORT:localhost:$DRIVER_PORT" 2>/dev/null || true
      mac 'pkill -x safaridriver 2>/dev/null || true'
      ssh -f -T -o BatchMode=yes -o ExitOnForwardFailure=yes \
        -L "$DRIVER_PORT:localhost:$DRIVER_PORT" "$MAC_HOST" \
        "/usr/bin/safaridriver --port $DRIVER_PORT"
      for _ in $(seq 1 10); do
        curl -sf "http://localhost:$DRIVER_PORT/status" >/dev/null 2>&1 && break
        sleep 1
      done
      RESP=$(wd POST /session "{\"capabilities\":{\"alwaysMatch\":$CAPS}}")
      SID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['value'].get('sessionId',''))" 2>/dev/null || true)
    fi
    if [ -z "$SID" ]; then echo "session failed: $RESP" >&2; exit 1; fi
    echo "$SID" > "$SID_FILE"
    echo "$RESP" | python3 -c "import json,sys; c=json.load(sys.stdin)['value']['capabilities']; print(c.get('safari:deviceName'), c.get('browserVersion'))"
    echo "session: $SID"
    ;;

  ipad-open) # <story-id-or-url>
    wd POST "/session/$(sid)/url" "{\"url\":\"$(story_url "$2")\"}" >/dev/null
    echo "opened on iPad: $(story_url "$2")"
    ;;

  ipad-js) # <script> — sync script, `return` its result
    SCRIPT=$(python3 -c 'import json,sys; print(json.dumps({"script": sys.argv[1], "args": []}))' "$2")
    wd POST "/session/$(sid)/execute/sync" "$SCRIPT"
    echo
    ;;

  ipad-viewport) # probe vh/dvh/svh/lvh, safe-area, visualViewport, keyboard state
    SCRIPT=$(python3 -c 'import json,sys; print(json.dumps({"script": sys.argv[1], "args": []}))' "$VIEWPORT_PROBE")
    wd POST "/session/$(sid)/execute/sync" "$SCRIPT" | python3 -m json.tool
    ;;

  ipad-type) # <css-selector> <text> — tap the field and type; opens the real soft keyboard
    EID=$(find_el "$2")
    wd POST "/session/$(sid)/element/$EID/click" '{}' >/dev/null
    BODY=$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1]}))' "$3")
    wd POST "/session/$(sid)/element/$EID/value" "$BODY"
    echo
    ;;

  ipad-tap) # <css-selector>
    EID=$(find_el "$2")
    wd POST "/session/$(sid)/element/$EID/click" '{}'
    echo
    ;;

  ipad-shot) # <out.png> [css-selector] — element screenshot (full-screen endpoint is broken on real devices)
    EID=$(find_el "${3:-html}")
    wd GET "/session/$(sid)/element/$EID/screenshot" \
      | python3 -c "import json,sys,base64; open(sys.argv[1],'wb').write(base64.b64decode(json.load(sys.stdin)['value']))" "$2"
    file "$2"
    ;;

  ipad-end)
    [ -f "$SID_FILE" ] && wd DELETE "/session/$(sid)" >/dev/null && rm -f "$SID_FILE"
    pkill -f "ssh.*-L $DRIVER_PORT:localhost:$DRIVER_PORT" 2>/dev/null || true
    mac 'pkill -x safaridriver 2>/dev/null || true'
    echo "session + tunnel closed"
    ;;

  *)
    sed -n "s/^  \([a-z-]*\)) #\?/\1 /p" "$0"
    echo "state: $STATE_DIR   mac host: $MAC_HOST (override: ETHLETE_MAC_HOST)"
    ;;
esac
