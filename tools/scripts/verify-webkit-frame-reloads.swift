import Cocoa
import WebKit

let urls = Array(CommandLine.arguments.dropFirst())
guard !urls.isEmpty, urls.allSatisfy({ URL(string: $0)?.host != nil }) else {
    fputs("Usage: swift tools/scripts/verify-webkit-frame-reloads.swift <frame-url> [<frame-url> ...]\n", stderr)
    exit(2)
}
let iterations = max(1, Int(ProcessInfo.processInfo.environment["WEBKIT_RELOAD_ITERATIONS"] ?? "40") ?? 40)
let encoded = String(data: try JSONSerialization.data(withJSONObject: urls), encoding: .utf8)!

final class ReloadProbe: NSObject, WKScriptMessageHandler {
    let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1440, height: 900))
    var window: NSWindow!
    let startedAt = Date()
    var lastBatch = "none"

    func start() {
        web.configuration.userContentController.add(self, name: "reloadProbe")
        let script = """
        addEventListener('load', () => {
          const urls = \(encoded);
          let batch = 0;
          const timer = setInterval(() => {
            document.querySelectorAll('iframe').forEach(frame => frame.remove());
            for (const src of urls) {
              const frame = document.createElement('iframe');
              const url = new URL(src);
              url.searchParams.set('reload-probe', batch);
              frame.src = url.href;
              frame.style.cssText = 'width:1440px;height:900px';
              document.body.append(frame);
            }
            window.webkit.messageHandlers.reloadProbe.postMessage('batch ' + (++batch));
            if (batch === \(iterations)) {
              clearInterval(timer);
              setTimeout(() => window.webkit.messageHandlers.reloadProbe.postMessage('PASS'), 1000);
            }
          }, 150);
        }, {once:true});
        """
        web.configuration.userContentController.addUserScript(
            WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
            styleMask: [.titled, .closable], backing: .buffered, defer: false
        )
        window.title = "WebKit frame reload regression"
        window.contentView = web
        window.orderFront(nil)
        web.loadHTMLString("<!doctype html><body></body>", baseURL: URL(string: "http://localhost:4221/"))
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(iterations) * 0.15 + 30) {
            fputs("FAIL: WebKit stopped responding during frame replacement, last batch: \(self.lastBatch)\n", stderr)
            exit(1)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let text = String(describing: message.body)
        if text.hasPrefix("batch") { lastBatch = text }
        print("\(Int(Date().timeIntervalSince(startedAt) * 1000))ms \(text)")
        fflush(stdout)
        if text == "PASS" { NSApp.terminate(nil) }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let probe = ReloadProbe()
probe.start()
app.run()
