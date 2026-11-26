---
'@ethlete/cli': patch
---

`design dom --app` refuses a state it cannot render (a forced hover, active or focus state, or a state a click opens) instead of printing idle or closed HTML.
