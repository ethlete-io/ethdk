---
status: accepted
open: B480
decided: 2026-11-10
source: grill session 2026-11-10 (Mac night shift)
---

# Studio moves to CEF on every platform, after a Mac spike

Studio shows live parts in WKWebView on macOS and WebView2 on Windows; Linux already runs CEF (Chromium). Frame
pictures and every design check run in Chromium, so on the Mac the live iframe over the picture comes from another
engine, and a whole class of WebKit-only defects and checks follows. The direction is CEF on every platform: one engine
for the live view, the picture and the check. First a day-shift spike on the Mac checks that the CEF build runs, how
large the bundle gets and that signing and notarization work; the human then confirms the switch. Safari coverage of
components stays the job of Storybook and the Apple device checks. The HTML-in-Canvas API is not the reason: it does
not replace the iframes. The human: "wenn wir durch die neue api gewinne fahren könnten wäre ich auch Fine damit erstmal
auf jeder Platform cef mit zu shippen", "Gefühlt machen die unterschiedlichen Renderer eh auch Probleme beim Abgleich.
Safari rendert anders als cef. Das würden wir ja auch unabhängig lösen durch cef überall. Oder?" and, to the spike
first, "Ok".
