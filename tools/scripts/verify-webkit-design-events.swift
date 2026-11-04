import Cocoa
import WebKit

let args = Array(CommandLine.arguments.dropFirst())
guard let givenUrl = args.first.flatMap({ URL(string: $0) }), givenUrl.host != nil else {
    fputs("Usage: swift tools/scripts/verify-webkit-design-events.swift <page-url> [<hold-seconds>]\n", stderr)
    exit(2)
}
let pageUrl = givenUrl
let holdSeconds = args.count > 1 ? Int(args[1]) ?? 90 : 90

final class EventsProbe: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 800, height: 600))
    var window: NSWindow!
    var startedAt = Date()

    var elapsed: String { String(format: "%.1f", Date().timeIntervalSince(startedAt)) }

    func start() {
        if web.responds(to: NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")) {
            web.perform(NSSelectorFromString("_setWindowOcclusionDetectionEnabled:"), with: nil)
        }
        for name in ["_setHiddenPageDOMTimerThrottlingEnabled:", "_setPageVisibilityBasedProcessSuppressionEnabled:"]
        where web.configuration.preferences.responds(to: NSSelectorFromString(name)) {
            web.configuration.preferences.perform(NSSelectorFromString(name), with: nil)
        }
        web.configuration.userContentController.add(self, name: "eventsProbe")
        web.navigationDelegate = self
        // A borderless window is not pulled back onto a screen; a titled one would be.
        window = NSWindow(
            contentRect: NSRect(x: -20000, y: 0, width: 800, height: 600),
            styleMask: [.borderless], backing: .buffered, defer: false
        )
        window.contentView = web
        window.orderFront(nil)
        web.load(URLRequest(url: pageUrl))
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
            if !self.opened { self.fail("the page did not load within 30 s") }
        }
    }

    var opened = false

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !opened else { return }
        opened = true
        startedAt = Date()
        let script = """
        const source = new EventSource('/__design/comment-events');
        source.onopen = () => webkit.messageHandlers.eventsProbe.postMessage('open');
        source.onerror = () => webkit.messageHandlers.eventsProbe.postMessage('error ' + source.readyState);
        undefined;
        """
        web.evaluateJavaScript(script) { _, error in
            if let error = error { self.fail("could not open the EventSource: \(error)") }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(holdSeconds)) {
            print("PASS: the event stream stayed open for \(holdSeconds) s")
            fflush(stdout)
            NSApp.terminate(nil)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        fail("the page failed to load: \(error)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        fail("the page failed to load: \(error)")
    }

    func fail(_ reason: String) {
        fputs("FAIL: \(reason)\n", stderr)
        exit(1)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let text = String(describing: message.body)
        print("\(elapsed) s \(text)")
        fflush(stdout)
        if text.hasPrefix("error") {
            fail("the event stream closed at \(elapsed) s, before the \(holdSeconds) s hold ended")
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let probe = EventsProbe()
probe.start()
app.run()
