import Cocoa
import ScreenCaptureKit
import WebKit

let usage = """
Usage: swift tools/scripts/verify-webkit-studio.swift soak <design-url> <batches> <frame-path> [<frame-path> ...]
       swift tools/scripts/verify-webkit-studio.swift edges <studio-url> <call-view-json>
       swift tools/scripts/verify-webkit-studio.swift paint <studio-url> <call-view-json> <hangs> [<png-dir>]

"""
let args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 3, ["soak", "edges", "paint"].contains(args[0]), let givenUrl = URL(string: args[1]),
    givenUrl.host != nil
else {
    fputs(usage, stderr)
    exit(2)
}
let pageUrl = givenUrl
let mode = args[0]
let viewport = NSSize(width: 1440, height: 900)

func json(_ value: Any) -> String {
    String(data: try! JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]), encoding: .utf8)!
}

let tauriStub = """
(() => {
  const callbacks = new Map();
  let lastCallback = 0;
  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => {
      if (command === 'window_chrome_watch') return null;
      const response = await fetch('/__host', { method: 'POST', body: JSON.stringify({ command, args }) });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    transformCallback: (callback) => (callbacks.set(++lastCallback, callback), lastCallback),
    unregisterCallback: (id) => callbacks.delete(id),
    convertFileSrc: (path) => path,
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  };
})();
"""

final class Probe: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let web: WKWebView
    var window: NSWindow!
    let startedAt = Date()
    var lastProgress = Date()
    var lastMessage = "none"

    override init() {
        let configuration = WKWebViewConfiguration()
        for name in ["_setHiddenPageDOMTimerThrottlingEnabled:", "_setPageVisibilityBasedProcessSuppressionEnabled:"]
        where configuration.preferences.responds(to: NSSelectorFromString(name)) {
            configuration.preferences.perform(NSSelectorFromString(name), with: nil)
        }
        web = WKWebView(frame: NSRect(origin: .zero, size: viewport), configuration: configuration)
    }

    var elapsed: String { String(format: "%.1f", Date().timeIntervalSince(startedAt)) }

    func start() {
        if web.responds(to: NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")) {
            web.perform(NSSelectorFromString("_setWindowOcclusionDetectionEnabled:"), with: nil)
        }
        web.configuration.userContentController.add(self, name: "probe")
        web.navigationDelegate = self
        // A borderless window is not pulled back onto a screen; a titled one would be.
        var origin = NSPoint(x: -20000, y: 0)
        if mode == "paint", let screen = NSScreen.main?.visibleFrame {
            origin = NSPoint(x: screen.minX, y: screen.maxY - viewport.height)
        }
        window = NSWindow(
            contentRect: NSRect(origin: origin, size: viewport), styleMask: [.borderless], backing: .buffered,
            defer: false
        )
        window.contentView = web
        if mode == "paint" {
            window.level = .floating
            window.ignoresMouseEvents = true
        }
        window.orderFrontRegardless()
        switch mode {
        case "soak": startSoak()
        default: startStudio()
        }
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if Date().timeIntervalSince(self.lastProgress) > 30 {
                self.fail("WebKit stopped responding for 30 s, last message: \(self.lastMessage)")
            }
        }
    }

    func say(_ text: String) {
        print("\(elapsed) s \(text)")
        fflush(stdout)
    }

    func fail(_ reason: String) -> Never {
        fputs("FAIL: \(reason)\n", stderr)
        exit(1)
    }

    func pass(_ reason: String) -> Never {
        print("PASS: \(reason)")
        fflush(stdout)
        exit(0)
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let text = String(describing: message.body)
        lastProgress = Date()
        lastMessage = text
        if text.hasPrefix("FAIL ") { fail(String(text.dropFirst(5))) }
        if text.hasPrefix("PASS ") { pass(String(text.dropFirst(5))) }
        if !text.hasPrefix("tick") { say(text) }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        fail("the page failed to load: \(error)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        fail("the page failed to load: \(error)")
    }

    func run(_ script: String, _ arguments: [String: Any] = [:]) async throws -> Any? {
        try await web.callAsyncJavaScript(script, arguments: arguments, in: nil, contentWorld: .page)
    }

    func startSoak() {
        let batches = Int(args[2]) ?? 300
        let paths = Array(args.dropFirst(3))
        let script = """
        addEventListener('load', () => {
          const post = (text) => webkit.messageHandlers.probe.postMessage(text);
          const paths = \(json(paths));
          let batch = 0;
          const mount = () => {
            document.querySelectorAll('iframe').forEach((frame) => frame.remove());
            for (const path of paths) {
              const frame = document.createElement('iframe');
              frame.src = path + (path.includes('?') ? '&' : '?') + 'soak=' + batch;
              frame.style.cssText = 'width:1440px;height:900px';
              document.body.append(frame);
            }
            batch += 1;
          };
          const settle = () => {
            const frames = [...document.querySelectorAll('iframe')];
            const drawn = () => frames.filter((frame) => frame.contentDocument?.body?.childElementCount).length;
            const since = Date.now();
            const check = setInterval(() => {
              post('tick');
              if (drawn() === frames.length) {
                clearInterval(check);
                post('batch ' + batch + ' drew every frame');
                if (batch >= \(batches)) post('PASS ' + batch + ' batches of ' + paths.length + ' frames, every checkpoint drew');
                else churn();
              } else if (Date.now() - since > 20000) {
                clearInterval(check);
                post('FAIL batch ' + batch + ' drew ' + drawn() + ' of ' + frames.length + ' frames within 20 s: WebKit hung loading the design modules');
              }
            }, 250);
          };
          const churn = () => {
            mount();
            post('tick');
            if (batch % 50 && batch < \(batches)) setTimeout(churn, 150);
            else settle();
          };
          churn();
        }, { once: true });
        """
        web.configuration.userContentController.addUserScript(
            WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        web.loadHTMLString("<!doctype html><body style=\"margin:0\"></body>", baseURL: pageUrl)
    }

    func startStudio() {
        let view = args[2]
        let seed = "localStorage.setItem('ethlete-studio.call-view', \(json(view)));"
        web.configuration.userContentController.addUserScript(
            WKUserScript(source: tauriStub + seed, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        web.load(URLRequest(url: pageUrl))
        Task { @MainActor in
            do {
                try await waitForShell()
                if mode == "edges" { try await checkEdges() } else { try await checkPaint() }
            } catch {
                fail("\(error)")
            }
        }
    }

    func waitForShell() async throws {
        for _ in 0..<120 {
            lastProgress = Date()
            let ready = try await run(
                """
                const tree = document.querySelector('ethlete-part-tree');
                const frames = document.querySelectorAll('ethlete-design-canvas iframe');
                return !!tree && tree.getBoundingClientRect().width > 0 && frames.length > 0;
                """
            ) as? Bool
            if ready == true {
                try await Task.sleep(nanoseconds: 3_000_000_000)
                say("the Studio shell is up")
                return
            }
            try await Task.sleep(nanoseconds: 500_000_000)
        }
        fail("the Studio shell showed no part tree and no canvas frame within 60 s")
    }

    func wheel(at point: NSPoint, dx: Int32, dy: Int32, phase: Int64) {
        let flipped = NSPoint(x: point.x, y: viewport.height - point.y)
        let onScreen = window.convertPoint(toScreen: flipped)
        let screenHeight = NSScreen.screens.first?.frame.height ?? viewport.height
        guard
            let cg = CGEvent(
                scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: dy, wheel2: dx, wheel3: 0
            )
        else { fail("could not create a scroll wheel event") }
        cg.location = CGPoint(x: onScreen.x, y: screenHeight - onScreen.y)
        cg.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
        cg.setIntegerValueField(.scrollWheelEventScrollPhase, value: phase)
        cg.setIntegerValueField(.scrollWheelEventMomentumPhase, value: 0)
        cg.setIntegerValueField(.mouseEventWindowUnderMousePointer, value: Int64(window.windowNumber))
        cg.setIntegerValueField(
            .mouseEventWindowUnderMousePointerThatCanHandleThisEvent, value: Int64(window.windowNumber)
        )
        guard let event = NSEvent(cgEvent: cg) else { fail("could not wrap a scroll wheel event") }
        web.scrollWheel(with: event)
    }

    let measure = """
    const target = id === 'root' ? document.scrollingElement : document.querySelector(`[data-edge-probe="${id}"]`);
    const first = id === 'root' ? document.body : target.firstElementChild;
    const box = target.getBoundingClientRect();
    const inner = first ? first.getBoundingClientRect() : box;
    return [target.scrollLeft, target.scrollTop, inner.left - box.left, inner.top - box.top, scrollX, scrollY];
    """

    func checkEdges() async throws {
        let containers =
            try await run(
                """
                const found = [...document.querySelectorAll('ethlete-root *')].filter((element) => {
                  const style = getComputedStyle(element);
                  const box = element.getBoundingClientRect();
                  const scrolls = (overflow, size, client) => /auto|scroll/.test(overflow) && size > client + 1;
                  return box.width > 40 && box.height > 40 && box.right > 0 && box.bottom > 0 &&
                    box.left < innerWidth && box.top < innerHeight &&
                    (scrolls(style.overflowY, element.scrollHeight, element.clientHeight) ||
                      scrolls(style.overflowX, element.scrollWidth, element.clientWidth));
                });
                return [
                  { id: 'root', name: 'html', x: innerWidth / 2, y: innerHeight / 2, axes: ['y', 'x'] },
                  ...found.map((element, index) => {
                    element.dataset.edgeProbe = String(index);
                    const box = element.getBoundingClientRect();
                    const left = Math.max(box.left, 0), top = Math.max(box.top, 0);
                    const right = Math.min(box.right, innerWidth), bottom = Math.min(box.bottom, innerHeight);
                    const axes = [];
                    if (element.scrollHeight > element.clientHeight + 1) axes.push('y');
                    if (element.scrollWidth > element.clientWidth + 1) axes.push('x');
                    const name = element.tagName.toLowerCase() + (element.className && typeof element.className === 'string'
                      ? '.' + element.className.trim().split(/\\s+/).slice(0, 3).join('.') : '');
                    return { id: String(index), name, x: (left + right) / 2, y: (top + bottom) / 2, axes };
                  }),
                ];
                """
            ) as? [[String: Any]] ?? []
        say("\(containers.count - 1) scroll containers in the shell besides the root")
        if containers.count < 2 { fail("the Studio shell showed no scroll container to probe") }
        var bounces: [String] = []
        for container in containers {
            let id = container["id"] as! String
            let name = container["name"] as! String
            let point = NSPoint(x: container["x"] as! Double, y: container["y"] as! Double)
            for axis in container["axes"] as! [String] {
                for toEnd in [false, true] {
                    let edge = axis == "y" ? (toEnd ? "bottom" : "top") : (toEnd ? "right" : "left")
                    let given: [String: Any] = ["id": id, "axis": axis, "toEnd": toEnd]
                    _ = try await run(
                        """
                        const target = id === 'root' ? document.scrollingElement : document.querySelector(`[data-edge-probe="${id}"]`);
                        if (axis === 'y') target.scrollTop = toEnd ? target.scrollHeight : 0;
                        else target.scrollLeft = toEnd ? target.scrollWidth : 0;
                        """, given
                    )
                    try await Task.sleep(nanoseconds: 300_000_000)
                    let rest = try await run(measure, given) as? [Double] ?? []
                    let push: Int32 = toEnd ? -40 : 40
                    var worst = 0.0
                    wheel(at: point, dx: axis == "x" ? push : 0, dy: axis == "y" ? push : 0, phase: 1)
                    for _ in 0..<12 {
                        try await Task.sleep(nanoseconds: 16_000_000)
                        wheel(at: point, dx: axis == "x" ? push : 0, dy: axis == "y" ? push : 0, phase: 2)
                        try await Task.sleep(nanoseconds: 16_000_000)
                        let now = try await run(measure, given) as? [Double] ?? []
                        for (a, b) in zip(rest, now) { worst = max(worst, abs(a - b)) }
                    }
                    wheel(at: point, dx: 0, dy: 0, phase: 4)
                    try await Task.sleep(nanoseconds: 800_000_000)
                    lastProgress = Date()
                    say(String(format: "%@ %@: offset %.1f px", name, edge, worst))
                    if worst > 0.5 { bounces.append(String(format: "%@ %@ (%.1f px)", name, edge, worst)) }
                }
            }
        }
        if !bounces.isEmpty { fail("WebKit bounced at the scroll edge of \(bounces.joined(separator: ", "))") }
        pass("no scroll container of the Studio shell moved past its edges")
    }

    var captureFilter: Any?

    func requireScreenRecording() async {
        if !CGPreflightScreenCaptureAccess() {
            CGRequestScreenCaptureAccess()
            fail(
                "the paint check needs the Screen Recording permission (System Settings > Privacy & Security > Screen & System Audio Recording) for the app that runs this script (Terminal, iTerm, VS Code, ...); grant it, restart that app, and run again"
            )
        }
        guard #available(macOS 14, *) else { fail("the paint check needs macOS 14 for ScreenCaptureKit screenshots") }
        let content: SCShareableContent
        do {
            content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        } catch {
            fail("ScreenCaptureKit refused to list windows, so the Screen Recording permission is likely missing: \(error)")
        }
        guard let own = content.windows.first(where: { $0.windowID == CGWindowID(window.windowNumber) }) else {
            fail("ScreenCaptureKit does not list the probe window \(window.windowNumber) as on screen")
        }
        captureFilter = SCContentFilter(desktopIndependentWindow: own)
    }

    // takeSnapshot repaints the page in the WebContent process, so it never shows what the compositor draws while
    // that process hangs (finding 375); a window server capture does.
    func capture(_ rect: NSRect) async throws -> CGImage {
        guard #available(macOS 14, *), let filter = captureFilter as? SCContentFilter else {
            fail("the window capture was not set up")
        }
        let scale = window.backingScaleFactor
        let configuration = SCStreamConfiguration()
        configuration.width = Int(viewport.width * scale)
        configuration.height = Int(viewport.height * scale)
        configuration.showsCursor = false
        configuration.ignoreShadowsSingleWindow = true
        let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)
        let factor = CGFloat(image.width) / viewport.width
        let crop = CGRect(x: rect.minX * factor, y: rect.minY * factor, width: rect.width * factor, height: rect.height * factor)
            .integral
        guard let cropped = image.cropping(to: crop) else { fail("the window capture could not be cropped to \(rect)") }
        return cropped
    }

    func pixels(_ image: CGImage) -> [UInt8] {
        var data = [UInt8](repeating: 0, count: image.width * image.height * 4)
        data.withUnsafeMutableBytes { bytes in
            let context = CGContext(
                data: bytes.baseAddress, width: image.width, height: image.height, bitsPerComponent: 8,
                bytesPerRow: image.width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            )
            context?.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        }
        return data
    }

    func differs(_ a: [UInt8], _ b: [UInt8]) -> Int {
        guard a.count == b.count else { return Int.max }
        var count = 0
        for pixel in stride(from: 0, to: a.count, by: 4)
        where (0..<3).contains(where: { abs(Int(a[pixel + $0]) - Int(b[pixel + $0])) > 16 }) {
            count += 1
        }
        return count
    }

    func save(_ image: CGImage, _ name: String) -> String {
        let directory = args.count > 4 ? args[4] : NSTemporaryDirectory()
        let url = URL(fileURLWithPath: directory).appendingPathComponent(name)
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])?.write(to: url)
        return url.path
    }

    func explorerOverlap() async throws -> [Double] {
        try await run(
            """
            const tree = document.querySelector('ethlete-part-tree');
            const panel = (tree?.closest('aside') ?? tree)?.getBoundingClientRect();
            if (!panel) return [];
            const inset = 14;
            const left = Math.max(panel.left + inset, 0);
            const top = Math.max(panel.top + inset, 0);
            const right = Math.min(panel.right - inset, innerWidth);
            const bottom = Math.min(panel.bottom - inset, innerHeight);
            let covered = 0;
            for (const frame of document.querySelectorAll('ethlete-design-canvas iframe')) {
              const box = frame.getBoundingClientRect();
              const width = Math.min(right, box.right) - Math.max(left, box.left);
              const height = Math.min(bottom, box.bottom) - Math.max(top, box.top);
              if (width > 0 && height > 0) covered = Math.max(covered, width * height);
            }
            return [left, top, right - left, bottom - top, covered];
            """
        ) as? [Double] ?? []
    }

    func checkPaint() async throws {
        let hangs = Int(args[3]) ?? 24
        await requireScreenRecording()
        var probe = try await explorerOverlap()
        guard probe.count == 5, probe[2] > 40, probe[3] > 40 else { fail("the explorer panel is not on screen") }
        for _ in 0..<40 where probe[4] < probe[2] * probe[3] * 0.3 {
            lastProgress = Date()
            _ = try await run(
                """
                const canvas = document.querySelector('ethlete-design-canvas');
                canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }));
                canvas.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }));
                """
            )
            try await Task.sleep(nanoseconds: 200_000_000)
            probe = try await explorerOverlap()
        }
        guard probe[4] >= probe[2] * probe[3] * 0.3 else {
            fail("panning the canvas right by 40 arrow presses put no frame under 30 % of the explorer panel")
        }
        let rect = NSRect(x: probe[0], y: probe[1], width: probe[2], height: probe[3])
        say("explorer probe \(rect), a frame covers \(Int(probe[4])) px² of it")
        try await Task.sleep(nanoseconds: 1_500_000_000)
        let baselineImage = try await capture(rect)
        say("baseline \(save(baselineImage, "explorer-baseline.png"))")
        let baseline = pixels(baselineImage)
        try await Task.sleep(nanoseconds: 500_000_000)
        let settled = try await capture(rect)
        if differs(baseline, pixels(settled)) > 0 {
            fail("the explorer changed with nothing running, so the probe is unusable: \(save(settled, "explorer-unstable.png"))")
        }
        let delays = [0, 30, 80, 150, 300]
        let busyTimes = [1500, 2000, 2500, 3000]
        var shots = 0
        for hang in 0..<hangs {
            lastProgress = Date()
            let rounds = 1 + hang % 3
            let delay = delays[hang % delays.count]
            let busy = busyTimes[hang % busyTimes.count]
            let startsAt = Date().addingTimeInterval(Double((rounds - 1) * 150 + delay) / 1000)
            web.evaluateJavaScript(
                """
                (() => {
                  const churn = (round) => {
                    for (const frame of document.querySelectorAll('ethlete-design-canvas iframe')) {
                      const next = frame.cloneNode();
                      const url = new URL(frame.src);
                      url.searchParams.set('churn', '\(hang)-' + round);
                      next.src = url.href;
                      frame.replaceWith(next);
                    }
                    if (round + 1 < \(rounds)) return setTimeout(() => churn(round + 1), 150);
                    setTimeout(() => {
                      const end = performance.now() + \(busy);
                      while (performance.now() < end) {}
                    }, \(delay));
                  };
                  churn(0);
                })();
                """
            ) { _, _ in }
            let endsAt = startsAt.addingTimeInterval(Double(busy) / 1000)
            try await Task.sleep(nanoseconds: UInt64(max(startsAt.timeIntervalSinceNow, 0) * 1e9) + 200_000_000)
            while endsAt.timeIntervalSinceNow > 0.15 {
                let now = try await capture(rect)
                shots += 1
                let changed = differs(baseline, pixels(now))
                if changed > 0 {
                    let path = save(now, "explorer-changed.png")
                    fail("\(changed) explorer pixels changed while WebContent hung for \(busy) ms (hang \(hang + 1) of \(hangs)): \(path)")
                }
                try await Task.sleep(nanoseconds: 150_000_000)
            }
            try await Task.sleep(nanoseconds: UInt64(max(endsAt.timeIntervalSinceNow, 0) * 1e9) + 700_000_000)
            if hang % 5 == 4 { say("\(hang + 1) hangs, \(shots) captures") }
        }
        if shots < hangs { fail("only \(shots) captures landed inside \(hangs) hangs") }
        pass("the explorer kept every pixel through \(hangs) main-thread hangs over churned frames (\(shots) captures)")
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let probe = Probe()
probe.start()
app.run()
