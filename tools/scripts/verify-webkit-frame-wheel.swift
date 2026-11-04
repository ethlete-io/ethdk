import Cocoa
import WebKit

let usage = """
Usage: swift tools/scripts/verify-webkit-frame-wheel.swift
  Sends trackpad wheel gestures to a WKWebView over three iframe setups inside a canvas that takes the wheel:
  bare        the iframe sits in a `pointer-events: none` wrapper (the Sketches page before finding 381)
  shielded    the same, plus a `pointer-events: auto` cover after the iframe (ethlete-frame-shield)
  iframe-none the iframe itself has `pointer-events: none` (the design canvas without its shield)
  Each runs a gesture that starts over the iframe and one that starts on the canvas and moves over it.
  Fails when the shielded iframe gets any wheel event or the canvas misses one.

"""
if CommandLine.arguments.contains("--help") { print(usage); exit(0) }

let viewport = NSSize(width: 1440, height: 900)
let frameDoc = """
<body style="margin:0;height:3000px;background:linear-gradient(#fff,#99f)"><script>\
addEventListener('wheel',()=>parent.postMessage('frame-wheel','*'),{passive:true})</script></body>
"""
let frameSrc = "data:text/html," + frameDoc.addingPercentEncoding(withAllowedCharacters: .alphanumerics)!
let column = { (name: String, left: Int, inner: String) in
    "<div data-col=\"\(name)\" style=\"position:absolute;left:\(left)px;top:100px;width:300px;height:600px\">\(inner)</div>"
}
let iframe = { (style: String) in "<iframe src=\"\(frameSrc)\" style=\"display:block;width:300px;height:600px;border:0;\(style)\"></iframe>" }
let page = """
<!doctype html><html><body style="margin:0;overflow:hidden">
<div id="canvas" style="position:relative;width:1440px;height:900px;overflow:hidden;background:#eee">
\(column("bare", 100, "<div style=\"pointer-events:none\">\(iframe(""))</div>"))
\(column("shielded", 500, "<div style=\"pointer-events:none;position:relative\">\(iframe(""))<div style=\"position:absolute;inset:0;pointer-events:auto\"></div></div>"))
\(column("iframe-none", 900, iframe("pointer-events:none")))
</div>
<script>
let canvasWheels = 0, frameWheels = 0;
document.getElementById('canvas').addEventListener('wheel', (e) => { e.preventDefault(); canvasWheels++; }, { passive: false });
addEventListener('message', (e) => { if (e.data === 'frame-wheel') frameWheels++; });
window.takeCounts = () => { const counts = [canvasWheels, frameWheels]; canvasWheels = 0; frameWheels = 0; return counts; };
</script></body></html>
"""

let COLUMNS: [(name: String, x: CGFloat)] = [("bare", 250), ("shielded", 650), ("iframe-none", 1050)]
let STEPS = 10

final class Probe: NSObject, WKNavigationDelegate {
    let web: WKWebView
    var window: NSWindow!

    override init() {
        let configuration = WKWebViewConfiguration()
        for name in ["_setHiddenPageDOMTimerThrottlingEnabled:", "_setPageVisibilityBasedProcessSuppressionEnabled:"]
        where configuration.preferences.responds(to: NSSelectorFromString(name)) {
            configuration.preferences.perform(NSSelectorFromString(name), with: nil)
        }
        web = WKWebView(frame: NSRect(origin: .zero, size: viewport), configuration: configuration)
    }

    func start() {
        if web.responds(to: NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")) {
            web.perform(NSSelectorFromString("_setWindowOcclusionDetectionEnabled:"), with: nil)
        }
        web.navigationDelegate = self
        window = NSWindow(
            contentRect: NSRect(origin: NSPoint(x: -20000, y: 0), size: viewport), styleMask: [.borderless],
            backing: .buffered, defer: false
        )
        window.contentView = web
        window.orderFrontRegardless()
        web.loadHTMLString(page, baseURL: URL(string: "http://localhost/"))
    }

    func wheel(at point: NSPoint, dy: Int32, phase: Int64) {
        let onScreen = window.convertPoint(toScreen: NSPoint(x: point.x, y: viewport.height - point.y))
        let screenHeight = NSScreen.screens.first?.frame.height ?? viewport.height
        guard let cg = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: dy, wheel2: 0, wheel3: 0)
        else { finish("could not create a scroll wheel event", ok: false) }
        cg.location = CGPoint(x: onScreen.x, y: screenHeight - onScreen.y)
        cg.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
        cg.setIntegerValueField(.scrollWheelEventScrollPhase, value: phase)
        cg.setIntegerValueField(.scrollWheelEventMomentumPhase, value: 0)
        cg.setIntegerValueField(.mouseEventWindowUnderMousePointer, value: Int64(window.windowNumber))
        cg.setIntegerValueField(.mouseEventWindowUnderMousePointerThatCanHandleThisEvent, value: Int64(window.windowNumber))
        guard let event = NSEvent(cgEvent: cg) else { finish("could not wrap a scroll wheel event", ok: false) }
        web.scrollWheel(with: event)
    }

    func gesture(from start: NSPoint, to end: NSPoint) async throws -> (canvas: Int, frame: Int) {
        for step in 0..<STEPS {
            let t = CGFloat(step) / CGFloat(STEPS - 1)
            let at = NSPoint(x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t)
            wheel(at: at, dy: -12, phase: step == 0 ? 1 : step == STEPS - 1 ? 4 : 2)
            try await Task.sleep(nanoseconds: 16_000_000)
        }
        try await Task.sleep(nanoseconds: 600_000_000)
        let counts = try await web.callAsyncJavaScript("return takeCounts()", arguments: [:], in: nil, contentWorld: .page)
        let pair = counts as? [Int] ?? [-1, -1]
        return (pair[0], pair[1])
    }

    func run() async throws {
        try await Task.sleep(nanoseconds: 1_500_000_000)
        var failed = false
        for col in COLUMNS {
            let over = NSPoint(x: col.x, y: 400)
            for (label, from) in [("starts over the iframe", over), ("enters it mid-gesture", NSPoint(x: col.x - 140, y: 50))] {
                let counts = try await gesture(from: from, to: over)
                let clean = counts.frame == 0 && counts.canvas == STEPS
                if col.name == "shielded" && !clean { failed = true }
                print("\(clean ? "CANVAS" : "FRAME ") \(col.name.padding(toLength: 12, withPad: " ", startingAt: 0)) \(label): canvas \(counts.canvas)/\(STEPS), iframe \(counts.frame)")
            }
        }
        finish(failed ? "the shielded iframe took wheel events" : "the shield keeps every wheel event on the canvas", ok: !failed)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task { @MainActor in
            do { try await run() } catch { finish("\(error)", ok: false) }
        }
    }

    func finish(_ reason: String, ok: Bool) -> Never {
        print("\(ok ? "PASS" : "FAIL") \(reason)")
        exit(ok ? 0 : 1)
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let probe = Probe()
probe.start()
app.run()
