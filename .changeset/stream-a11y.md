---
'@ethlete/components': patch
---

Stream: accessibility fixes for the built-in overlays and self-created player iframes.

- The iframes created by the Kick, SOOP, Dailymotion and TikTok players now carry a descriptive `title` (`"<Platform> player"`). YouTube, Vimeo, Twitch and Facebook iframes are created by the platform SDKs and cannot be titled from the library.
- The loading overlay is now a `role="status"` region labelled "Loading", the error overlay announces itself via `role="alert"`, and the consent gate is a `role="group"` labelled by its heading.
