import Cocoa
import WebKit

let usage = """
Usage: swift tools/scripts/verify-webkit-pinch.swift <frame-url> [--synthetic | --stale [--stale-control]] [--recreate] [--seconds N]
  no mode       pinch by hand over the four columns; logs native events, page gesture events and every WebContent termination
  --synthetic   sends magnify, rotate and smart-magnify events over chrome, a live, an inactive and a swapped iframe
  --stale       kills WebContent while gesture replies are pending, then pinches four times
  --recreate    answers a WebContent termination with a new WKWebView instead of a reload

"""
let args = Array(CommandLine.arguments.dropFirst())
let frameURL: String = args.first(where: { !$0.hasPrefix("--") }) ?? ""
if frameURL.isEmpty || URL(string: frameURL)?.host == nil { fputs(usage, stderr); exit(2) }
let synthetic = args.contains("--synthetic")
let stale = args.contains("--stale") || args.contains("--stale-control")
let control = args.contains("--stale-control")
let recreate = args.contains("--recreate")
let rounds = 5
let seconds = args.firstIndex(of: "--seconds").map { Double(args[$0 + 1]) ?? 120 } ?? 120
let started = Date()
func log(_ s: String) { print("\(Int(Date().timeIntervalSince(started) * 1000))ms \(s)"); fflush(stdout) }

let page = """
<!doctype html><html><body style="margin:0;display:grid;grid-template-columns:repeat(4,360px);height:900px;font:14px sans-serif">
<div id="chrome" style="background:#ddd">chrome</div>
<iframe id="live" src="\(frameURL)" style="width:360px;height:900px;border:0"></iframe>
<iframe id="inactive" src="\(frameURL)" style="width:360px;height:900px;border:0;pointer-events:none"></iframe>
<div id="swap" style="position:relative"><iframe id="swapframe" src="\(frameURL)" style="width:360px;height:900px;border:0"></iframe></div>
<script>
const post = m => window.webkit.messageHandlers.pinch.postMessage(m);
const where = e => (e.target && e.target.id) || e.target.nodeName;
for (const t of ['gesturestart','gesturechange','gestureend'])
  addEventListener(t, e => post(t + ' scale=' + e.scale.toFixed(3) + ' on ' + where(e)), {passive:true});
addEventListener('wheel', e => { if (e.ctrlKey) post('wheel ctrl dy=' + e.deltaY.toFixed(2) + ' on ' + where(e)); }, {passive:true});
let n = 0;
addEventListener('gesturechange', () => {
  const s = document.getElementById('swap');
  if (++n % 3) return;
  s.replaceChildren();
  const f = document.createElement('iframe');
  f.src = '\(frameURL)&n=' + n; f.style.cssText = 'width:360px;height:900px;border:0';
  s.append(f);
});
</script></body></html>
"""

final class Harness: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var web: WKWebView
    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
                          styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
    var crashes = 0
    var monitor: Any?

    override init() {
        let config = WKWebViewConfiguration()
        // A locked or covered screen suspends the page; these WebKit SPIs keep it running. `nil` passes `false`.
        for s in ["_setHiddenPageDOMTimerThrottlingEnabled:", "_setPageVisibilityBasedProcessSuppressionEnabled:"]
        where config.preferences.responds(to: NSSelectorFromString(s)) {
            config.preferences.perform(NSSelectorFromString(s), with: nil)
        }
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1440, height: 900), configuration: config)
        super.init()
        if web.responds(to: NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")) {
            web.perform(NSSelectorFromString("_setWindowOcclusionDetectionEnabled:"), with: nil)
        }
        web.configuration.userContentController.add(self, name: "pinch")
        web.navigationDelegate = self
        window.contentView = web
        window.setFrameOrigin(.zero)
        window.title = "WebKit pinch probe"
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        web.loadHTMLString(page, baseURL: URL(string: "http://localhost:4221/"))
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.magnify, .smartMagnify, .rotate, .gesture, .beginGesture, .endGesture, .scrollWheel, .pressure]) { e in
            let p = e.locationInWindow
            var extra = ""
            if e.type == .magnify { extra = " mag=\(String(format: "%.3f", e.magnification))" }
            if e.type == .scrollWheel { extra = " dy=\(e.scrollingDeltaY) momentum=\(e.momentumPhase.rawValue)" }
            log("native \(e.type.rawValue) phase=\(e.phase.rawValue)\(extra) at \(Int(p.x)),\(Int(p.y))")
            return e
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        crashes += 1
        if recreate {
            log("CRASH WebContent terminated (#\(crashes)), recreating the WKWebView")
            let config = webView.configuration
            config.userContentController.removeScriptMessageHandler(forName: "pinch")
            let next = WKWebView(frame: webView.frame, configuration: config)
            next.configuration.userContentController.add(self, name: "pinch")
            next.navigationDelegate = self
            webView.navigationDelegate = nil
            window.contentView = next
            web = next
            next.loadHTMLString(page, baseURL: URL(string: "http://localhost:4221/"))
            return
        }
        log("CRASH WebContent terminated (#\(crashes)), reloading")
        webView.loadHTMLString(page, baseURL: URL(string: "http://localhost:4221/"))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { log("page loaded") }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        log("page \(message.body)")
    }
}

// Undocumented CGEvent fields: 110 gesture HID type (8 zoom, 5 rotate, 22 smart magnify), 113 value, 132 phase.
func gesture(at p: CGPoint, mag: Double, phase: Int64, hidType: Int64 = 8) -> NSEvent? {
    guard let cg = CGEvent(source: nil) else { return nil }
    cg.type = CGEventType(rawValue: 29)!
    cg.location = CGPoint(x: p.x, y: (NSScreen.screens.first?.frame.height ?? 900) - p.y)
    cg.setIntegerValueField(CGEventField(rawValue: 110)!, value: hidType)
    cg.setDoubleValueField(CGEventField(rawValue: 113)!, value: mag)
    cg.setIntegerValueField(CGEventField(rawValue: 132)!, value: phase)
    return NSEvent(cgEvent: cg)
}

func scroll(at p: CGPoint, dy: Int32, phase: Int64) -> NSEvent? {
    guard let cg = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: dy, wheel2: 0, wheel3: 0) else { return nil }
    cg.location = CGPoint(x: p.x, y: (NSScreen.screens.first?.frame.height ?? 900) - p.y)
    cg.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
    cg.setIntegerValueField(CGEventField(rawValue: 99)!, value: phase)
    return NSEvent(cgEvent: cg)
}

enum Mode: String { case paced, burst, interleaved, removeMidGesture, noEnd, rotate, smart }

func pinch(_ h: Harness, at x: CGFloat, label: String, mode: Mode, steps: Int = 12) {
    let p = CGPoint(x: x, y: 450)
    log("synthetic \(mode.rawValue) over \(label)")
    var seq: [NSEvent?] = []
    switch mode {
    case .smart:
        let cg = CGEvent(source: nil)!
        cg.type = CGEventType(rawValue: 29)!
        cg.location = CGPoint(x: p.x, y: (NSScreen.screens.first?.frame.height ?? 900) - p.y)
        cg.setIntegerValueField(CGEventField(rawValue: 110)!, value: 22)
        seq = [NSEvent(cgEvent: cg)]
    case .rotate:
        seq.append(gesture(at: p, mag: 0, phase: 1, hidType: 5))
        for _ in 0..<steps { seq.append(gesture(at: p, mag: 2, phase: 2, hidType: 5)) }
        seq.append(gesture(at: p, mag: 0, phase: 4, hidType: 5))
    default:
        seq.append(gesture(at: p, mag: 0, phase: 1))
        for i in 0..<steps {
            seq.append(gesture(at: p, mag: i < steps / 2 ? 0.04 : -0.04, phase: 2))
            if mode == .interleaved { seq.append(scroll(at: p, dy: i % 2 == 0 ? 3 : -3, phase: i == 0 ? 1 : 2)) }
        }
        if mode == .interleaved { seq.append(scroll(at: p, dy: 0, phase: 4)) }
        if mode != .noEnd { seq.append(gesture(at: p, mag: 0, phase: 4)) }
    }
    for (i, e) in seq.enumerated() {
        guard let e else { log("no NSEvent from CGEvent"); return }
        if i == 0 { log("native type \(e.type.rawValue) phase \(e.phase.rawValue)") }
        h.window.sendEvent(e)
        if mode == .removeMidGesture && i == 3 {
            h.web.evaluateJavaScript("for (const f of document.querySelectorAll('iframe')) { const n = f.cloneNode(); n.src = f.src.split('&n=')[0] + '&n=' + Date.now(); f.replaceWith(n); } document.body.style.transform = 'scale(' + (0.9 + Math.random() * 0.2) + ')';")
        }
        if mode != .burst { RunLoop.current.run(until: Date().addingTimeInterval(0.016)) }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let h = Harness()
DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
    log("DONE crashes=\(h.crashes)"); exit(h.crashes == 0 ? 0 : 1)
}
func webContentPID(_ h: Harness) -> Int32 {
    (h.web.value(forKey: "_webProcessIdentifier") as? NSNumber)?.int32Value ?? 0
}
if stale {
    func after(_ t: Double, _ f: @escaping () -> Void) { DispatchQueue.main.asyncAfter(deadline: .now() + t, execute: f) }
    after(5) {
        let pid = webContentPID(h)
        log("stale: WebContent pid \(pid), blocking its main thread for 2 s")
        h.web.evaluateJavaScript("{ const t = Date.now(); while (Date.now() - t < 2000) {} }")
        after(0.2) {
            if !control { pinch(h, at: 180, label: "chrome while WebContent is busy", mode: .noEnd, steps: 4) }
            after(0.3) {
                log("stale: SIGKILL WebContent \(pid) with gesture replies pending")
                kill(pid, SIGKILL)
                for i in 0..<4 {
                    after(Double(i + 1) * 5) {
                        log("stale: pinch \(i + 1) after the kill, WebContent pid \(webContentPID(h)), crashes so far \(h.crashes)")
                        pinch(h, at: 180, label: "chrome", mode: .paced)
                    }
                }
                after(24) {
                    log("stale DONE: \(h.crashes - 1) terminations after the deliberate kill")
                    exit(h.crashes > 1 ? 1 : 0)
                }
            }
        }
    }
} else if synthetic {
    DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
        let targets: [(CGFloat, String)] = [(180, "chrome"), (540, "live iframe"), (900, "inactive iframe"), (1260, "swapped iframe")]
        let modes: [Mode] = [.paced, .burst, .interleaved, .removeMidGesture, .noEnd, .rotate, .smart]
        for round in 0..<rounds {
            for mode in modes {
                for (x, label) in targets {
                    pinch(h, at: x, label: "\(label) r\(round)", mode: mode)
                    RunLoop.current.run(until: Date().addingTimeInterval(mode == .burst ? 0 : 0.1))
                }
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
        RunLoop.current.run(until: Date().addingTimeInterval(2))
        log("synthetic DONE crashes=\(h.crashes)")
        exit(h.crashes == 0 ? 0 : 1)
    }
} else {
    log("pinch with the trackpad over: chrome (x 0-360), live iframe (360-720), inactive iframe (720-1080), swapping iframe (1080-1440); Ctrl+C to stop")
}
app.run()
