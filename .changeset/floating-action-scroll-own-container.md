---
'@ethlete/components': patch
---

Scroll only the nearest scroll container in `FloatingActionDirective.scrollToTop()` instead of calling `scrollIntoView`, so it no longer scrolls a page that embeds the content in an iframe.
